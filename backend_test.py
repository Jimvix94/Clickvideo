#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Click Social Media Platform
Tests all backend APIs including authentication, video upload, content moderation, 
like system, comments, and admin functionality.
"""

import requests
import json
import base64
import os
from datetime import datetime
import time

# Configuration
BACKEND_URL = "https://0102606f-389b-4e57-94f1-d9b2b022c1bc.preview.emergentagent.com/api"
ADMIN_USERNAME = "jimthesoul"
ADMIN_PASSWORD = "Jimthesoul@#"

# Test data
TEST_USER_1 = {
    "username": "sarah_jones",
    "email": "sarah.jones@example.com", 
    "password": "SecurePass123!"
}

TEST_USER_2 = {
    "username": "mike_wilson",
    "email": "mike.wilson@example.com",
    "password": "MyPassword456!"
}

INAPPROPRIATE_USER = {
    "username": "bad_user",
    "email": "bad.user@example.com",
    "password": "BadPass789!"
}

# Global variables to store tokens and IDs
user1_token = None
user2_token = None
admin_token = None
test_video_id = None
test_comment_id = None

def print_test_result(test_name, success, message=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if message:
        print(f"    {message}")
    print()

def create_test_video_data():
    """Create a small test video file as base64"""
    # Create a minimal test file (simulating video)
    test_content = b"FAKE_VIDEO_DATA_FOR_TESTING_PURPOSES_ONLY"
    return base64.b64encode(test_content).decode('utf-8')

def test_user_registration():
    """Test user registration functionality"""
    global user1_token, user2_token
    
    print("=== Testing User Registration ===")
    
    # Test successful registration for user 1
    try:
        response = requests.post(f"{BACKEND_URL}/register", json=TEST_USER_1)
        if response.status_code == 200:
            data = response.json()
            user1_token = data.get("access_token")
            print_test_result("User 1 Registration", True, f"User registered successfully: {data['user']['username']}")
        else:
            print_test_result("User 1 Registration", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("User 1 Registration", False, f"Exception: {str(e)}")
    
    # Test successful registration for user 2
    try:
        response = requests.post(f"{BACKEND_URL}/register", json=TEST_USER_2)
        if response.status_code == 200:
            data = response.json()
            user2_token = data.get("access_token")
            print_test_result("User 2 Registration", True, f"User registered successfully: {data['user']['username']}")
        else:
            print_test_result("User 2 Registration", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("User 2 Registration", False, f"Exception: {str(e)}")
    
    # Test duplicate email registration (should fail)
    try:
        response = requests.post(f"{BACKEND_URL}/register", json=TEST_USER_1)
        if response.status_code == 400:
            print_test_result("Duplicate Email Registration", True, "Correctly rejected duplicate email")
        else:
            print_test_result("Duplicate Email Registration", False, f"Should have failed with 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Duplicate Email Registration", False, f"Exception: {str(e)}")

def test_user_login():
    """Test user login functionality"""
    global user1_token
    
    print("=== Testing User Login ===")
    
    # Test successful login
    try:
        login_data = {"email": TEST_USER_1["email"], "password": TEST_USER_1["password"]}
        response = requests.post(f"{BACKEND_URL}/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            user1_token = data.get("access_token")  # Update token
            print_test_result("Valid User Login", True, f"Login successful for {data['user']['username']}")
        else:
            print_test_result("Valid User Login", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Valid User Login", False, f"Exception: {str(e)}")
    
    # Test invalid credentials
    try:
        login_data = {"email": TEST_USER_1["email"], "password": "wrongpassword"}
        response = requests.post(f"{BACKEND_URL}/login", json=login_data)
        if response.status_code == 401:
            print_test_result("Invalid Credentials Login", True, "Correctly rejected invalid credentials")
        else:
            print_test_result("Invalid Credentials Login", False, f"Should have failed with 401, got {response.status_code}")
    except Exception as e:
        print_test_result("Invalid Credentials Login", False, f"Exception: {str(e)}")

def test_admin_authentication():
    """Test admin authentication"""
    global admin_token
    
    print("=== Testing Admin Authentication ===")
    
    # Test valid admin login
    try:
        admin_data = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
        response = requests.post(f"{BACKEND_URL}/admin/login", json=admin_data)
        if response.status_code == 200:
            data = response.json()
            admin_token = data.get("access_token")
            print_test_result("Valid Admin Login", True, "Admin login successful")
        else:
            print_test_result("Valid Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Valid Admin Login", False, f"Exception: {str(e)}")
    
    # Test invalid admin credentials
    try:
        admin_data = {"username": "wrongadmin", "password": "wrongpass"}
        response = requests.post(f"{BACKEND_URL}/admin/login", json=admin_data)
        if response.status_code == 401:
            print_test_result("Invalid Admin Login", True, "Correctly rejected invalid admin credentials")
        else:
            print_test_result("Invalid Admin Login", False, f"Should have failed with 401, got {response.status_code}")
    except Exception as e:
        print_test_result("Invalid Admin Login", False, f"Exception: {str(e)}")

def test_video_upload():
    """Test video upload functionality"""
    global test_video_id
    
    print("=== Testing Video Upload ===")
    
    if not user1_token:
        print_test_result("Video Upload", False, "No user token available")
        return
    
    # Test successful video upload
    try:
        headers = {"Authorization": f"Bearer {user1_token}"}
        
        # Create test video file
        test_video_content = b"FAKE_VIDEO_CONTENT_FOR_TESTING"
        
        files = {
            'file': ('test_video.mp4', test_video_content, 'video/mp4')
        }
        data = {
            'title': 'My Amazing Travel Video',
            'description': 'A beautiful journey through the mountains and valleys'
        }
        
        response = requests.post(f"{BACKEND_URL}/videos", headers=headers, files=files, data=data)
        if response.status_code == 200:
            video_data = response.json()
            test_video_id = video_data['video']['id']
            print_test_result("Valid Video Upload", True, f"Video uploaded successfully: {video_data['video']['title']}")
        else:
            print_test_result("Valid Video Upload", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Valid Video Upload", False, f"Exception: {str(e)}")
    
    # Test upload without authentication
    try:
        files = {
            'file': ('test_video2.mp4', b"FAKE_VIDEO_CONTENT", 'video/mp4')
        }
        data = {
            'title': 'Unauthorized Video',
            'description': 'This should fail'
        }
        
        response = requests.post(f"{BACKEND_URL}/videos", files=files, data=data)
        if response.status_code == 403:
            print_test_result("Unauthorized Video Upload", True, "Correctly rejected unauthorized upload")
        else:
            print_test_result("Unauthorized Video Upload", False, f"Should have failed with 403, got {response.status_code}")
    except Exception as e:
        print_test_result("Unauthorized Video Upload", False, f"Exception: {str(e)}")

def test_content_moderation():
    """Test content moderation system"""
    print("=== Testing Content Moderation ===")
    
    if not user2_token:
        print_test_result("Content Moderation", False, "No user2 token available")
        return
    
    # Test inappropriate content upload (should auto-ban user)
    try:
        headers = {"Authorization": f"Bearer {user2_token}"}
        
        files = {
            'file': ('bad_video.mp4', b"FAKE_VIDEO_CONTENT", 'video/mp4')
        }
        data = {
            'title': 'Adult Content Video',  # Contains inappropriate keyword
            'description': 'This contains explicit material'  # Contains inappropriate keyword
        }
        
        response = requests.post(f"{BACKEND_URL}/videos", headers=headers, files=files, data=data)
        if response.status_code == 400:
            print_test_result("Inappropriate Content Detection", True, "Correctly detected and rejected inappropriate content")
        else:
            print_test_result("Inappropriate Content Detection", False, f"Should have failed with 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Inappropriate Content Detection", False, f"Exception: {str(e)}")
    
    # Test that banned user cannot login
    try:
        login_data = {"email": TEST_USER_2["email"], "password": TEST_USER_2["password"]}
        response = requests.post(f"{BACKEND_URL}/login", json=login_data)
        if response.status_code == 403:
            print_test_result("Banned User Login Block", True, "Correctly blocked banned user from logging in")
        else:
            print_test_result("Banned User Login Block", False, f"Should have failed with 403, got {response.status_code}")
    except Exception as e:
        print_test_result("Banned User Login Block", False, f"Exception: {str(e)}")

def test_video_retrieval():
    """Test video retrieval functionality"""
    print("=== Testing Video Retrieval ===")
    
    # Test getting all videos
    try:
        response = requests.get(f"{BACKEND_URL}/videos")
        if response.status_code == 200:
            videos = response.json()
            print_test_result("Get All Videos", True, f"Retrieved {len(videos)} videos")
        else:
            print_test_result("Get All Videos", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get All Videos", False, f"Exception: {str(e)}")
    
    # Test getting specific video
    if test_video_id:
        try:
            response = requests.get(f"{BACKEND_URL}/videos/{test_video_id}")
            if response.status_code == 200:
                video = response.json()
                print_test_result("Get Specific Video", True, f"Retrieved video: {video['title']}")
            else:
                print_test_result("Get Specific Video", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print_test_result("Get Specific Video", False, f"Exception: {str(e)}")

def test_like_system():
    """Test like/unlike functionality"""
    print("=== Testing Like System ===")
    
    if not user1_token or not test_video_id:
        print_test_result("Like System", False, "Missing user token or video ID")
        return
    
    headers = {"Authorization": f"Bearer {user1_token}"}
    
    # Test liking a video
    try:
        response = requests.post(f"{BACKEND_URL}/videos/{test_video_id}/like", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_test_result("Like Video", True, f"Video liked: {data['message']}")
        else:
            print_test_result("Like Video", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Like Video", False, f"Exception: {str(e)}")
    
    # Test getting like status
    try:
        response = requests.get(f"{BACKEND_URL}/videos/{test_video_id}/like-status", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_test_result("Get Like Status", True, f"Like status: {data['liked']}")
        else:
            print_test_result("Get Like Status", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Like Status", False, f"Exception: {str(e)}")
    
    # Test unliking a video
    try:
        response = requests.post(f"{BACKEND_URL}/videos/{test_video_id}/like", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_test_result("Unlike Video", True, f"Video unliked: {data['message']}")
        else:
            print_test_result("Unlike Video", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Unlike Video", False, f"Exception: {str(e)}")

def test_comment_system():
    """Test comment functionality"""
    global test_comment_id
    
    print("=== Testing Comment System ===")
    
    if not user1_token or not test_video_id:
        print_test_result("Comment System", False, "Missing user token or video ID")
        return
    
    headers = {"Authorization": f"Bearer {user1_token}"}
    
    # Test adding a comment
    try:
        comment_data = {"content": "This is an amazing video! Great work!"}
        response = requests.post(f"{BACKEND_URL}/videos/{test_video_id}/comments", 
                               headers=headers, json=comment_data)
        if response.status_code == 200:
            data = response.json()
            test_comment_id = data['comment']['id']
            print_test_result("Add Comment", True, f"Comment added: {data['comment']['content']}")
        else:
            print_test_result("Add Comment", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Add Comment", False, f"Exception: {str(e)}")
    
    # Test getting comments
    try:
        response = requests.get(f"{BACKEND_URL}/videos/{test_video_id}/comments")
        if response.status_code == 200:
            comments = response.json()
            print_test_result("Get Comments", True, f"Retrieved {len(comments)} comments")
        else:
            print_test_result("Get Comments", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Comments", False, f"Exception: {str(e)}")
    
    # Test inappropriate comment (should be rejected)
    try:
        comment_data = {"content": "This video contains adult content and violence"}
        response = requests.post(f"{BACKEND_URL}/videos/{test_video_id}/comments", 
                               headers=headers, json=comment_data)
        if response.status_code == 400:
            print_test_result("Inappropriate Comment Rejection", True, "Correctly rejected inappropriate comment")
        else:
            print_test_result("Inappropriate Comment Rejection", False, f"Should have failed with 400, got {response.status_code}")
    except Exception as e:
        print_test_result("Inappropriate Comment Rejection", False, f"Exception: {str(e)}")

def test_admin_panel_apis():
    """Test admin panel functionality"""
    print("=== Testing Admin Panel APIs ===")
    
    if not admin_token:
        print_test_result("Admin Panel APIs", False, "No admin token available")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test getting admin stats
    try:
        response = requests.get(f"{BACKEND_URL}/admin/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print_test_result("Get Admin Stats", True, f"Stats retrieved: {stats}")
        else:
            print_test_result("Get Admin Stats", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Admin Stats", False, f"Exception: {str(e)}")
    
    # Test getting all users
    try:
        response = requests.get(f"{BACKEND_URL}/admin/users", headers=headers)
        if response.status_code == 200:
            users = response.json()
            print_test_result("Get All Users", True, f"Retrieved {len(users)} users")
        else:
            print_test_result("Get All Users", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get All Users", False, f"Exception: {str(e)}")
    
    # Test getting all videos (including flagged)
    try:
        response = requests.get(f"{BACKEND_URL}/admin/videos", headers=headers)
        if response.status_code == 200:
            videos = response.json()
            print_test_result("Get All Videos (Admin)", True, f"Retrieved {len(videos)} videos")
        else:
            print_test_result("Get All Videos (Admin)", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get All Videos (Admin)", False, f"Exception: {str(e)}")
    
    # Test video moderation
    if test_video_id:
        try:
            moderation_data = {"status": "approved", "reason": "Content is appropriate"}
            response = requests.post(f"{BACKEND_URL}/admin/videos/{test_video_id}/moderate", 
                                   headers=headers, json=moderation_data)
            if response.status_code == 200:
                print_test_result("Video Moderation", True, "Video moderation successful")
            else:
                print_test_result("Video Moderation", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print_test_result("Video Moderation", False, f"Exception: {str(e)}")

def test_admin_access_control():
    """Test that regular users cannot access admin endpoints"""
    print("=== Testing Admin Access Control ===")
    
    if not user1_token:
        print_test_result("Admin Access Control", False, "No user token available")
        return
    
    headers = {"Authorization": f"Bearer {user1_token}"}  # Using regular user token
    
    # Test that regular user cannot access admin stats
    try:
        response = requests.get(f"{BACKEND_URL}/admin/stats", headers=headers)
        if response.status_code == 401:
            print_test_result("Regular User Admin Access Block", True, "Correctly blocked regular user from admin endpoint")
        else:
            print_test_result("Regular User Admin Access Block", False, f"Should have failed with 401, got {response.status_code}")
    except Exception as e:
        print_test_result("Regular User Admin Access Block", False, f"Exception: {str(e)}")

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Comprehensive Backend Testing for Click Social Media Platform")
    print("=" * 80)
    
    start_time = time.time()
    
    # Run tests in logical order
    test_user_registration()
    test_user_login()
    test_admin_authentication()
    test_video_upload()
    test_content_moderation()
    test_video_retrieval()
    test_like_system()
    test_comment_system()
    test_admin_panel_apis()
    test_admin_access_control()
    
    end_time = time.time()
    
    print("=" * 80)
    print(f"🏁 Testing completed in {end_time - start_time:.2f} seconds")
    print("=" * 80)

if __name__ == "__main__":
    run_all_tests()