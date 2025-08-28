import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const API_KEY = 'adidas-superstar-2025-secret'; // Must match backend API key

function App() {
  // State management
  const [mode, setMode] = useState('idle'); // 'idle' | 'session'
  const [preloadedImages, setPreloadedImages] = useState({});
  const [currentOutfits, setCurrentOutfits] = useState({});
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Helper function to get headers with API key
  const getApiHeaders = () => ({
    'x-api-key': API_KEY,
  });

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedKey = localStorage.getItem('adidas-api-key');
      
      if (storedKey === API_KEY) {
        // Key is stored and valid, proceed with authentication
        setIsAuthenticated(true);
        return;
      }
      
      // No valid key stored, show auth overlay
      setIsAuthenticated(false);
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Handle authentication form submission
  const handleAuth = async (e) => {
    e.preventDefault();
    
    if (authInput === API_KEY) {
      // Store key in localStorage
      localStorage.setItem('adidas-api-key', API_KEY);
      setIsAuthenticated(true);
      setAuthError('');
      setIsLoading(true);
      // Start loading the app
      preloadImages();
    } else {
      setAuthError('Invalid access key. Please contact system administrator.');
      setAuthInput('');
    }
  };

  // Preload all outfit images into memory
  const preloadImages = useCallback(async () => {
    try {
      console.log('Starting image preloading...');
      const response = await fetch(`${BACKEND_URL}/outfits`, {
        headers: getApiHeaders(),
      });
      const data = await response.json();
      
      const imagePromises = [];
      const imageMap = {};

      // Create promises for all image loads
      Object.entries(data.files).forEach(([category, files]) => {
        imageMap[category] = {};
        files.forEach(filename => {
          const img = new Image();
          const imageUrl = `${BACKEND_URL}/public/outfits/${filename}`;
          
          const promise = new Promise((resolve, reject) => {
            img.onload = () => {
              imageMap[category][filename] = imageUrl;
              resolve();
            };
            img.onerror = () => {
              console.warn(`Failed to load image: ${filename}`);
              resolve(); // Continue even if some images fail
            };
          });
          
          img.src = imageUrl;
          imagePromises.push(promise);
        });
      });

      // Load logo images and default head GIF
      const logoLeft = new Image();
      const logoRight = new Image();
      const headGif = new Image();
      
      const logoPromises = [
        new Promise(resolve => {
          logoLeft.onload = () => {
            imageMap['logo_left'] = `${BACKEND_URL}/public/outfits/Logo_Left_static.png`;
            resolve();
          };
          logoLeft.onerror = resolve;
          logoLeft.src = `${BACKEND_URL}/public/outfits/Logo_Left_static.png`;
        }),
        new Promise(resolve => {
          logoRight.onload = () => {
            imageMap['logo_right'] = `${BACKEND_URL}/public/outfits/Logo_Right_static.png`;
            resolve();
          };
          logoRight.onerror = resolve;
          logoRight.src = `${BACKEND_URL}/public/outfits/Logo_Right_static.png`;
        }),
        new Promise(resolve => {
          headGif.onload = () => {
            imageMap['default_head'] = `${BACKEND_URL}/public/outfits/Head.gif`;
            resolve();
          };
          headGif.onerror = resolve;
          headGif.src = `${BACKEND_URL}/public/outfits/Head.gif`;
        })
      ];

      // Wait for all images to load
      await Promise.all([...imagePromises, ...logoPromises]);
      
      setPreloadedImages(imageMap);
      setCurrentOutfits(data.randomOutfits);
      setIsLoading(false);
      
      console.log('All images preloaded successfully!', imageMap);
    } catch (error) {
      console.error('Error preloading images:', error);
      setIsLoading(false);
    }
  }, []);

  // Generate random outfits from preloaded images (excluding head)
  const generateRandomOutfits = useCallback(() => {
    // First, pick a random gender for consistency (now includes neutral)
    const genders = ['male', 'female', 'neutral'];
    const selectedGender = genders[Math.floor(Math.random() * genders.length)];
    
    const getRandomImageForGender = (part, gender) => {
      const category = `${gender}_${part}`;
      if (preloadedImages[category]) {
        const availableFiles = Object.keys(preloadedImages[category]);
        if (availableFiles.length > 0) {
          return availableFiles[Math.floor(Math.random() * availableFiles.length)];
        }
      }
      return null;
    };

    console.log('Generating random outfits for gender:', selectedGender);
    console.log('Available categories:', Object.keys(preloadedImages));

    return {
      // head is now handled separately - always use GIF in idle mode
      top: getRandomImageForGender('top', selectedGender),
      bottom: getRandomImageForGender('bottom', selectedGender),
      shoes: getRandomImageForGender('shoes', selectedGender),
      left: getRandomImageForGender('left', selectedGender),
      right: getRandomImageForGender('right', selectedGender),
    };
  }, [preloadedImages]);

  // SSE connection for backend events
  useEffect(() => {
    let eventSource;

    const connectSSE = () => {
      eventSource = new EventSource(`${BACKEND_URL}/events`);
      
      eventSource.onopen = () => {
        console.log('SSE connection established');
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE event received:', data);

          switch (data.type) {
            case 'connected':
              setConnectionStatus('connected');
              break;
              
            case 'idle':
              setMode('idle');
              setUserPhoto(null);
              setCurrentOutfits(generateRandomOutfits());
              break;
              
            case 'session':
              setMode('session');
              setUserPhoto(data.data?.userPhotoToken);
              setCurrentOutfits(data.data?.outfits || {});
              break;
              
            case 'timeout':
              setMode('idle');
              setUserPhoto(null);
              setCurrentOutfits(generateRandomOutfits());
              break;
              
            default:
              console.log('Unknown event type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setConnectionStatus('disconnected');
        
        // Reconnect after 10 seconds
        setTimeout(() => {
          if (eventSource.readyState === EventSource.CLOSED) {
            connectSSE();
          }
        }, 10000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [generateRandomOutfits]);

  // Update random outfits every 10 seconds in idle mode
  useEffect(() => {
    let interval;
    
    if (mode === 'idle' && Object.keys(preloadedImages).length > 0) {
      interval = setInterval(() => {
        setCurrentOutfits(generateRandomOutfits());
      }, 10000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [mode, preloadedImages, generateRandomOutfits]);

  // Start preloading on component mount (only when authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      preloadImages();
    }
  }, [isAuthenticated, preloadImages]);

  // Get image URL from preloaded images
  const getImageUrl = (filename) => {
    if (!filename) return null;
    
    // Check all categories for the filename
    for (const category of Object.keys(preloadedImages)) {
      if (preloadedImages[category][filename]) {
        return preloadedImages[category][filename];
      }
    }
    
    // Fallback to direct URL
    return `${BACKEND_URL}/public/outfits/${filename}`;
  };

  // Show authentication overlay if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="auth-overlay">
        <div className="auth-container">
          <div className="auth-content">
            <h1>Adidas Superstar Experience</h1>
            <p>Please enter the access key to continue</p>
            <form onSubmit={handleAuth} className="auth-form">
              <input
                type="password"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                placeholder="Access Key"
                className="auth-input"
                autoFocus
              />
              <button type="submit" className="auth-button">
                Access Display
              </button>
            </form>
            {authError && (
              <p className="auth-error">{authError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>Adidas Superstar Experience</h1>
          <div className="loading-spinner"></div>
          <p>Loading experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="status-bar">
        <span className={`connection-status ${connectionStatus}`}>
          {connectionStatus === 'connected' ? '🟢' : '🔴'} {connectionStatus}
        </span>
        <span className="mode-indicator">Mode: {mode}</span>
      </div>

      {/* render outfit images names for debug */}
      {/* <div className="outfit-names absolute top-10 left-10 z-10 bg-white bg-opacity-75 p-2 rounded shadow">
        <div><strong>Current Outfits:</strong></div>
        <div className="outfit-name head">Head: {mode === 'session' && userPhoto ? 'User Photo' : 'Default GIF'}</div>
        <div className="outfit-name top">Top: {currentOutfits.top || 'none'}</div>
        <div className="outfit-name bottom">Bottom: {currentOutfits.bottom || 'none'}</div>
        <div className="outfit-name shoes">Shoes: {currentOutfits.shoes || 'none'}</div>
        <div className="outfit-name left">Left: {currentOutfits.left || 'none'}</div>
        <div className="outfit-name right">Right: {currentOutfits.right || 'none'}</div>
        <div><strong>Images loaded:</strong> {Object.keys(preloadedImages).length}</div>
      </div> */}

      <div className="display-grid">
        {/* Row 1: Logo Left - Head - Logo Right */}
        <div className="grid-item logo-left">
          <img 
            src={preloadedImages.logo_left} 
            alt="Adidas Logo Left" 
            className="outfit-image"
          />
        </div>

        <div className="grid-item outfit-head">
          {mode === 'session' && userPhoto ? (
            <img 
              src={userPhoto} 
              alt="User Head" 
              className="user-photo"
            />
          ) : (
            <img 
              src={preloadedImages.default_head} 
              alt="Default Head Animation" 
              className="outfit-image"
            />
          )}
        </div>

        <div className="grid-item logo-right">
          <img 
            src={preloadedImages.logo_right} 
            alt="Adidas Logo Right" 
            className="outfit-image"
          />
        </div>

        {/* Row 2: Left - Top - Right */}
        <div className="grid-item outfit-left">
          {currentOutfits.left && (
            <img 
              src={getImageUrl(currentOutfits.left)} 
              alt="Left" 
              className="outfit-image"
            />
          )}
        </div>

        <div className="grid-item outfit-top">
          {currentOutfits.top && (
            <img 
              src={getImageUrl(currentOutfits.top)} 
              alt="Top" 
              className="outfit-image"
            />
          )}
        </div>

        <div className="grid-item outfit-right">
          {currentOutfits.right && (
            <img 
              src={getImageUrl(currentOutfits.right)} 
              alt="Right" 
              className="outfit-image"
            />
          )}
        </div>

        {/* Row 3: Empty - Bottom - Shoes */}
        <div className="grid-item grid-spacer">
          {/* Empty space for symmetry */}
        </div>

        <div className="grid-item outfit-bottom">
          {currentOutfits.bottom && (
            <img 
              src={getImageUrl(currentOutfits.bottom)} 
              alt="Bottom" 
              className="outfit-image"
            />
          )}
        </div>

        <div className="grid-item outfit-shoes">
          {currentOutfits.shoes && (
            <img 
              src={getImageUrl(currentOutfits.shoes)} 
              alt="Shoes" 
              className="outfit-image"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
