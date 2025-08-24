import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function App() {
  // State management
  const [mode, setMode] = useState('idle'); // 'idle' | 'session'
  const [preloadedImages, setPreloadedImages] = useState({});
  const [currentOutfits, setCurrentOutfits] = useState({});
  const [userPhoto, setUserPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Preload all outfit images into memory
  const preloadImages = useCallback(async () => {
    try {
      console.log('Starting image preloading...');
      const response = await fetch(`${BACKEND_URL}/outfits`);
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

      // Load logo images
      const logoLeft = new Image();
      const logoRight = new Image();
      
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

  // Generate random outfits from preloaded images
  const generateRandomOutfits = useCallback(() => {
    const getRandomImage = (part) => {
      const genders = ['male', 'female', 'neutral'];
      const allFiles = [];
      
      genders.forEach(gender => {
        const category = `${gender}_${part}`;
        if (preloadedImages[category]) {
          allFiles.push(...Object.keys(preloadedImages[category]));
        }
      });
      
      if (allFiles.length === 0) return null;
      return allFiles[Math.floor(Math.random() * allFiles.length)];
    };

    return {
      head: getRandomImage('head'), // Dynamic head based on gender
      top: getRandomImage('top'),
      bottom: getRandomImage('bottom'),
      shoes: getRandomImage('shoes'),
      left: getRandomImage('left'),
      right: getRandomImage('right'),
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
              setUserPhoto(data.data?.userPhoto);
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
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          if (eventSource.readyState === EventSource.CLOSED) {
            connectSSE();
          }
        }, 5000);
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

  // Start preloading on component mount
  useEffect(() => {
    preloadImages();
  }, [preloadImages]);

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

      {/* render outfit images names for debug*/}
      <div className="outfit-names absolute top-10 left-10 z-10 bg-white bg-opacity-75 p-2 rounded shadow">
        <span className="outfit-name head">{currentOutfits.head}</span>
        <span className="outfit-name top">{currentOutfits.top}</span>
        <span className="outfit-name bottom">{currentOutfits.bottom}</span>
        <span className="outfit-name shoes">{currentOutfits.shoes}</span>
        <span className="outfit-name left">{currentOutfits.left}</span>
        <span className="outfit-name right">{currentOutfits.right}</span>
      </div>

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
          ) : currentOutfits.head ? (
            <img 
              src={getImageUrl(currentOutfits.head)} 
              alt="Head" 
              className="outfit-image"
            />
          ) : (
            <div className="head-placeholder">
              <h3>Head</h3>
            </div>
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
