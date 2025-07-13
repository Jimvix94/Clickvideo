from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
import uuid
import os
import base64
import re
from dotenv import load_dotenv
from pathlib import Path
import logging

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Admin credentials
ADMIN_USERNAME = "jimthesoul"
ADMIN_PASSWORD = "Jimthesoul@#"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class VideoUpload(BaseModel):
    title: str
    description: str
    file_data: str  # base64 encoded video

class CommentCreate(BaseModel):
    content: str
    video_id: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_banned: bool = False
    ban_reason: Optional[str] = None

class Video(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    file_data: str  # base64 encoded
    user_id: str
    username: str
    likes: int = 0
    views: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_flagged: bool = False
    moderation_status: str = "pending"  # pending, approved, rejected

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    video_id: str
    user_id: str
    username: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Like(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Utility functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.get("is_banned", False):
        raise HTTPException(status_code=403, detail="User is banned")
    
    return user

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        admin_type: str = payload.get("type")
        if admin_type != "admin":
            raise HTTPException(status_code=401, detail="Admin access required")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    return True

def detect_inappropriate_content(content: str) -> bool:
    """Simple content detection - replace with Google AI in production"""
    inappropriate_words = [
        "adult", "sexual", "porn", "xxx", "explicit", "nude", "naked", 
        "abuse", "violence", "illegal", "drugs", "hate"
    ]
    content_lower = content.lower()
    return any(word in content_lower for word in inappropriate_words)

# Authentication endpoints
@api_router.post("/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    user_dict = user.dict()
    user_dict["password"] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id, "type": "user"}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.post("/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    if user.get("is_banned", False):
        raise HTTPException(status_code=403, detail=f"Account banned: {user.get('ban_reason', 'Violation of terms')}")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"], "type": "user"}, expires_delta=access_token_expires
    )
    
    user_obj = User(**{k: v for k, v in user.items() if k != "password"})
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

# Admin authentication
@api_router.post("/admin/login")
async def admin_login(admin_data: AdminLogin):
    if admin_data.username != ADMIN_USERNAME or admin_data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES * 4)  # Longer session for admin
    access_token = create_access_token(
        data={"sub": "admin", "type": "admin"}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "admin": True}

# Video endpoints
@api_router.post("/videos")
async def upload_video(title: str = Form(...), description: str = Form(...), 
                      file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # Read file and convert to base64
    file_content = await file.read()
    file_base64 = base64.b64encode(file_content).decode('utf-8')
    
    # Content moderation check
    is_inappropriate = (detect_inappropriate_content(title) or 
                       detect_inappropriate_content(description))
    
    video = Video(
        title=title,
        description=description,
        file_data=file_base64,
        user_id=current_user["id"],
        username=current_user["username"],
        is_flagged=is_inappropriate,
        moderation_status="rejected" if is_inappropriate else "approved"
    )
    
    if is_inappropriate:
        # Auto-ban user for inappropriate content
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"is_banned": True, "ban_reason": "Uploaded inappropriate content"}}
        )
        raise HTTPException(status_code=400, detail="Content violates community guidelines. Account has been banned.")
    
    await db.videos.insert_one(video.dict())
    return {"message": "Video uploaded successfully", "video": video}

@api_router.get("/videos")
async def get_videos(skip: int = 0, limit: int = 20):
    videos = await db.videos.find({"moderation_status": "approved"}).skip(skip).limit(limit).to_list(limit)
    return [Video(**video) for video in videos]

@api_router.get("/videos/{video_id}")
async def get_video(video_id: str):
    video = await db.videos.find_one({"id": video_id, "moderation_status": "approved"})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Increment view count
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    video["views"] += 1
    
    return Video(**video)

# Like system
@api_router.post("/videos/{video_id}/like")
async def like_video(video_id: str, current_user: dict = Depends(get_current_user)):
    # Check if video exists
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check if already liked
    existing_like = await db.likes.find_one({"video_id": video_id, "user_id": current_user["id"]})
    if existing_like:
        # Unlike
        await db.likes.delete_one({"video_id": video_id, "user_id": current_user["id"]})
        await db.videos.update_one({"id": video_id}, {"$inc": {"likes": -1}})
        return {"message": "Video unliked", "liked": False}
    else:
        # Like
        like = Like(video_id=video_id, user_id=current_user["id"])
        await db.likes.insert_one(like.dict())
        await db.videos.update_one({"id": video_id}, {"$inc": {"likes": 1}})
        return {"message": "Video liked", "liked": True}

@api_router.get("/videos/{video_id}/like-status")
async def get_like_status(video_id: str, current_user: dict = Depends(get_current_user)):
    like = await db.likes.find_one({"video_id": video_id, "user_id": current_user["id"]})
    return {"liked": like is not None}

# Comment system
@api_router.post("/videos/{video_id}/comments")
async def add_comment(video_id: str, comment_data: dict, current_user: dict = Depends(get_current_user)):
    # Check if video exists
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Content moderation for comments
    if detect_inappropriate_content(comment_data["content"]):
        raise HTTPException(status_code=400, detail="Comment contains inappropriate content")
    
    comment = Comment(
        content=comment_data["content"],
        video_id=video_id,
        user_id=current_user["id"],
        username=current_user["username"]
    )
    
    await db.comments.insert_one(comment.dict())
    return {"message": "Comment added", "comment": comment}

@api_router.get("/videos/{video_id}/comments")
async def get_comments(video_id: str, skip: int = 0, limit: int = 50):
    comments = await db.comments.find({"video_id": video_id}).skip(skip).limit(limit).to_list(limit)
    return [Comment(**comment) for comment in comments]

# Admin endpoints
@api_router.get("/admin/videos")
async def admin_get_all_videos(admin: bool = Depends(get_admin_user)):
    videos = await db.videos.find().to_list(1000)
    return [Video(**video) for video in videos]

@api_router.post("/admin/videos/{video_id}/moderate")
async def moderate_video(video_id: str, action: dict, admin: bool = Depends(get_admin_user)):
    # action: {"status": "approved|rejected", "reason": "optional reason"}
    status = action.get("status")
    reason = action.get("reason", "")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {"moderation_status": status}
    if status == "rejected":
        update_data["is_flagged"] = True
        if reason:
            update_data["rejection_reason"] = reason
    
    await db.videos.update_one({"id": video_id}, {"$set": update_data})
    return {"message": f"Video {status}", "video_id": video_id}

@api_router.get("/admin/users")
async def admin_get_users(admin: bool = Depends(get_admin_user)):
    users = await db.users.find().to_list(1000)
    return [{k: v for k, v in user.items() if k != "password"} for user in users]

@api_router.post("/admin/users/{user_id}/ban")
async def ban_user(user_id: str, ban_data: dict, admin: bool = Depends(get_admin_user)):
    reason = ban_data.get("reason", "Violation of community guidelines")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_banned": True, "ban_reason": reason, "banned_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also reject all pending videos from this user
    await db.videos.update_many(
        {"user_id": user_id, "moderation_status": "pending"},
        {"$set": {"moderation_status": "rejected", "is_flagged": True}}
    )
    
    return {"message": "User banned successfully"}

@api_router.post("/admin/users/{user_id}/unban")
async def unban_user(user_id: str, admin: bool = Depends(get_admin_user)):
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_banned": False}, "$unset": {"ban_reason": "", "banned_at": ""}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User unbanned successfully"}

@api_router.delete("/admin/videos/{video_id}")
async def delete_video(video_id: str, admin: bool = Depends(get_admin_user)):
    result = await db.videos.delete_one({"id": video_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Also delete associated comments and likes
    await db.comments.delete_many({"video_id": video_id})
    await db.likes.delete_many({"video_id": video_id})
    
    return {"message": "Video deleted successfully"}

@api_router.delete("/admin/comments/{comment_id}")
async def delete_comment(comment_id: str, admin: bool = Depends(get_admin_user)):
    result = await db.comments.delete_one({"id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"message": "Comment deleted successfully"}

# Stats endpoint for admin
@api_router.get("/admin/stats")
async def get_admin_stats(admin: bool = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    banned_users = await db.users.count_documents({"is_banned": True})
    total_videos = await db.videos.count_documents({})
    flagged_videos = await db.videos.count_documents({"is_flagged": True})
    pending_videos = await db.videos.count_documents({"moderation_status": "pending"})
    total_comments = await db.comments.count_documents({})
    
    return {
        "total_users": total_users,
        "banned_users": banned_users,
        "total_videos": total_videos,
        "flagged_videos": flagged_videos,
        "pending_videos": pending_videos,
        "total_comments": total_comments
    }

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()