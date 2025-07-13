import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Check if admin token
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.type === 'admin') {
          setIsAdmin(true);
        } else {
          // Get user info for regular users
          const userData = localStorage.getItem('user');
          if (userData) {
            setUser(JSON.parse(userData));
          }
        }
      } catch (error) {
        console.error('Invalid token');
        logout();
      }
    }
  }, [token]);

  const login = (tokenData, userData = null) => {
    setToken(tokenData);
    localStorage.setItem('token', tokenData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenData}`;
    
    if (userData) {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  const loginAdmin = (tokenData) => {
    setToken(tokenData);
    setIsAdmin(true);
    localStorage.setItem('token', tokenData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenData}`;
  };

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, token, login, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Components
const Navbar = ({ currentPage, setCurrentPage }) => {
  const { user, isAdmin, logout } = useAuth();

  return (
    <nav className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold cursor-pointer" onClick={() => setCurrentPage('home')}>
            🎬 Click
          </h1>
          {!isAdmin && (
            <div className="hidden md:flex space-x-4">
              <button 
                onClick={() => setCurrentPage('home')}
                className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'home' ? 'bg-white text-purple-600' : 'hover:bg-purple-500'}`}
              >
                Home
              </button>
              {user && (
                <button 
                  onClick={() => setCurrentPage('upload')}
                  className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 'upload' ? 'bg-white text-purple-600' : 'hover:bg-purple-500'}`}
                >
                  Upload
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {user || isAdmin ? (
            <div className="flex items-center space-x-4">
              {user && <span className="text-sm">Welcome, {user.username}!</span>}
              {isAdmin && <span className="text-sm bg-red-500 px-2 py-1 rounded">Admin Panel</span>}
              <button 
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage('login')}
                className="bg-white text-purple-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => setCurrentPage('register')}
                className="border border-white px-4 py-2 rounded-lg hover:bg-white hover:text-purple-600 transition-colors"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {!isAdmin && (
        <div className="md:hidden mt-4 flex space-x-2">
          <button 
            onClick={() => setCurrentPage('home')}
            className={`px-3 py-1 rounded transition-colors ${currentPage === 'home' ? 'bg-white text-purple-600' : 'hover:bg-purple-500'}`}
          >
            Home
          </button>
          {user && (
            <button 
              onClick={() => setCurrentPage('upload')}
              className={`px-3 py-1 rounded transition-colors ${currentPage === 'upload' ? 'bg-white text-purple-600' : 'hover:bg-purple-500'}`}
            >
              Upload
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

const Home = () => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [likeStatuses, setLikeStatuses] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API}/videos`);
      setVideos(response.data);
      
      // Fetch like statuses if user is logged in
      if (user) {
        const statuses = {};
        for (const video of response.data) {
          try {
            const likeResponse = await axios.get(`${API}/videos/${video.id}/like-status`);
            statuses[video.id] = likeResponse.data.liked;
          } catch (error) {
            statuses[video.id] = false;
          }
        }
        setLikeStatuses(statuses);
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const openVideo = async (video) => {
    setSelectedVideo(video);
    await fetchComments(video.id);
  };

  const fetchComments = async (videoId) => {
    try {
      const response = await axios.get(`${API}/videos/${videoId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const likeVideo = async (videoId) => {
    if (!user) {
      alert('Please login to like videos');
      return;
    }

    try {
      const response = await axios.post(`${API}/videos/${videoId}/like`);
      setLikeStatuses(prev => ({ ...prev, [videoId]: response.data.liked }));
      
      // Update video likes count
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, likes: video.likes + (response.data.liked ? 1 : -1) }
          : video
      ));

      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(prev => ({
          ...prev,
          likes: prev.likes + (response.data.liked ? 1 : -1)
        }));
      }
    } catch (error) {
      console.error('Failed to like video:', error);
    }
  };

  const addComment = async () => {
    if (!user) {
      alert('Please login to comment');
      return;
    }

    if (!newComment.trim()) return;

    try {
      await axios.post(`${API}/videos/${selectedVideo.id}/comments`, {
        content: newComment
      });
      setNewComment('');
      await fetchComments(selectedVideo.id);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add comment');
    }
  };

  const shareVideo = (video) => {
    if (navigator.share) {
      navigator.share({
        title: video.title,
        text: `Check out this video: ${video.title}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Video link copied to clipboard!');
    }
  };

  if (selectedVideo) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => setSelectedVideo(null)}
            className="mb-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            ← Back to Videos
          </button>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="aspect-video bg-black flex items-center justify-center">
              <video 
                controls 
                className="w-full h-full"
                src={`data:video/mp4;base64,${selectedVideo.file_data}`}
              >
                Your browser does not support video playback.
              </video>
            </div>
            
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedVideo.title}</h2>
              <p className="text-gray-600 mb-4">{selectedVideo.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">
                  By {selectedVideo.username} • {selectedVideo.views} views • {new Date(selectedVideo.created_at).toLocaleDateString()}
                </div>
                
                <div className="flex space-x-4">
                  <button 
                    onClick={() => likeVideo(selectedVideo.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      likeStatuses[selectedVideo.id] 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    <span>{likeStatuses[selectedVideo.id] ? '❤️' : '🤍'}</span>
                    <span>{selectedVideo.likes}</span>
                  </button>
                  
                  <button 
                    onClick={() => shareVideo(selectedVideo)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    📤 Share
                  </button>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Comments ({comments.length})</h3>
                
                {user && (
                  <div className="mb-6">
                    <div className="flex space-x-3">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 p-3 border border-gray-300 rounded-lg resize-none"
                        rows="3"
                      />
                      <button 
                        onClick={addComment}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-purple-600">{comment.username}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{comment.content}</p>
                    </div>
                  ))}
                  
                  {comments.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">Welcome to Click</h1>
          <p className="text-xl mb-8">The next generation video sharing platform with advanced content moderation</p>
          <div className="flex justify-center">
            <img 
              src="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwyfHxzb2NpYWwlMjBtZWRpYXxlbnwwfHx8fDE3NTIzOTM4NTF8MA&ixlib=rb-4.1.0&q=85"
              alt="Social Media Platform"
              className="rounded-lg shadow-lg max-w-md w-full"
            />
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-8 text-center">Latest Videos</h2>
        
        {videos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No videos uploaded yet. Be the first to share!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map(video => (
              <div key={video.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                <div 
                  className="aspect-video bg-black flex items-center justify-center"
                  onClick={() => openVideo(video)}
                >
                  <video 
                    className="w-full h-full object-cover"
                    src={`data:video/mp4;base64,${video.file_data}`}
                    muted
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">{video.title}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>By {video.username}</span>
                    <span>{video.views} views</span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        likeVideo(video.id);
                      }}
                      className={`flex items-center space-x-1 px-3 py-1 rounded transition-colors ${
                        likeStatuses[video.id] 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <span>{likeStatuses[video.id] ? '❤️' : '🤍'}</span>
                      <span>{video.likes}</span>
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        shareVideo(video);
                      }}
                      className="bg-blue-100 text-blue-600 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      📤 Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Upload = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please login to upload videos</h2>
        </div>
      </div>
    );
  }

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim() || !file) {
      alert('Please fill all fields and select a video file');
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('file', file);

      await axios.post(`${API}/videos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Video uploaded successfully!');
      setTitle('');
      setDescription('');
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('video-file');
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold mb-6 text-center">Upload Video</h2>
          
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter video title..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Describe your video..."
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video File
              </label>
              <input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Supported formats: MP4, WebM, AVI. Max size: 100MB
              </p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Content Guidelines</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• No adult, sexual, or explicit content</li>
                <li>• No violence, abuse, or hate speech</li>
                <li>• No illegal activities or drug-related content</li>
                <li>• Violations result in automatic account suspension</li>
              </ul>
            </div>
            
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/login`, { email, password });
      login(response.data.access_token, response.data.user);
      
    } catch (error) {
      alert(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6">Login to Click</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/register`, { username, email, password });
      login(response.data.access_token, response.data.user);
      
    } catch (error) {
      alert(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6">Join Click</h2>
        
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Admin Components
const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/admin/login`, { username, password });
      loginAdmin(response.data.access_token);
      
    } catch (error) {
      alert(error.response?.data?.detail || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center mb-6 text-red-600">Admin Access</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Admin Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState({});
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchVideos();
    fetchUsers();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API}/admin/videos`);
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const moderateVideo = async (videoId, status, reason = '') => {
    try {
      await axios.post(`${API}/admin/videos/${videoId}/moderate`, { status, reason });
      await fetchVideos();
      alert(`Video ${status} successfully`);
    } catch (error) {
      alert('Failed to moderate video');
    }
  };

  const banUser = async (userId, reason) => {
    if (!reason.trim()) {
      alert('Please provide a ban reason');
      return;
    }

    try {
      await axios.post(`${API}/admin/users/${userId}/ban`, { reason });
      await fetchUsers();
      alert('User banned successfully');
    } catch (error) {
      alert('Failed to ban user');
    }
  };

  const unbanUser = async (userId) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/unban`);
      await fetchUsers();
      alert('User unbanned successfully');
    } catch (error) {
      alert('Failed to unban user');
    }
  };

  const deleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    try {
      await axios.delete(`${API}/admin/videos/${videoId}`);
      await fetchVideos();
      alert('Video deleted successfully');
    } catch (error) {
      alert('Failed to delete video');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Navigation */}
      <div className="bg-gray-800 text-white p-4">
        <div className="max-w-7xl mx-auto flex space-x-6">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded ${activeTab === 'stats' ? 'bg-red-600' : 'hover:bg-gray-700'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded ${activeTab === 'videos' ? 'bg-red-600' : 'hover:bg-gray-700'}`}
          >
            Video Management
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-red-600' : 'hover:bg-gray-700'}`}
          >
            User Management
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Platform Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-600">Total Users</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.total_users || 0}</p>
                <p className="text-sm text-red-500">Banned: {stats.banned_users || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-600">Total Videos</h3>
                <p className="text-3xl font-bold text-green-600">{stats.total_videos || 0}</p>
                <p className="text-sm text-red-500">Flagged: {stats.flagged_videos || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-600">Total Comments</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.total_comments || 0}</p>
                <p className="text-sm text-yellow-500">Pending Review: {stats.pending_videos || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Video Management</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {videos.map(video => (
                    <tr key={video.id}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{video.title}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{video.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{video.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          video.moderation_status === 'approved' ? 'bg-green-100 text-green-800' :
                          video.moderation_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {video.moderation_status}
                        </span>
                        {video.is_flagged && <span className="ml-2 text-red-500">🚩</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{video.views}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {video.moderation_status === 'pending' && (
                          <>
                            <button 
                              onClick={() => moderateVideo(video.id, 'approved')}
                              className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => {
                                const reason = prompt('Rejection reason:');
                                if (reason) moderateVideo(video.id, 'rejected', reason);
                              }}
                              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => deleteVideo(video.id)}
                          className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">User Management</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">{user.username}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.is_banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {user.is_banned ? 'Banned' : 'Active'}
                        </span>
                        {user.is_banned && user.ban_reason && (
                          <div className="text-xs text-gray-500 mt-1">{user.ban_reason}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {!user.is_banned ? (
                          <button 
                            onClick={() => {
                              const reason = prompt('Ban reason:');
                              if (reason) banUser(user.id, reason);
                            }}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                          >
                            Ban User
                          </button>
                        ) : (
                          <button 
                            onClick={() => unbanUser(user.id)}
                            className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          >
                            Unban User
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const AppRouter = () => {
  const { user, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  
  // Handle admin route
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) {
      if (!isAdmin) {
        setCurrentPage('admin-login');
      } else {
        setCurrentPage('admin-dashboard');
      }
    }
  }, [isAdmin]);

  if (window.location.pathname.startsWith('/admin')) {
    if (!isAdmin) {
      return <AdminLogin />;
    }
    return <AdminDashboard />;
  }

  return (
    <div>
      <Navbar />
      {currentPage === 'home' && <Home />}
      {currentPage === 'upload' && <Upload />}
      {currentPage === 'login' && <Login />}
      {currentPage === 'register' && <Register />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;