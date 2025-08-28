import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
const API_KEY = 'adidas-superstar-2025-secret';

function ManualUpload() {
  const [step, setStep] = useState('gender'); // 'gender' | 'upload' | 'email' | 'success'
  const [gender, setGender] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Helper function to get headers with API key
  const getApiHeaders = () => ({
    'x-api-key': API_KEY,
  });

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (sessionId) {
      const eventSource = new EventSource(`${BACKEND_URL}/api/events`);
      
      eventSource.onopen = () => {
        setConnectionStatus('connected');
      };

      eventSource.onerror = () => {
        setConnectionStatus('disconnected');
      };

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('SSE Event received:', data);
      };

      return () => {
        eventSource.close();
      };
    }
  }, [sessionId]);

  const handleGenderSelect = (selectedGender) => {
    setGender(selectedGender);
    setStep('upload');
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return;
      }

      setSelectedFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !gender) {
      setError('Please select a photo and gender.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('gender', gender);
      formData.append('source', 'manual'); // Indicate this is a manual upload

      const response = await fetch(`${BACKEND_URL}/api/session`, {
        method: 'POST',
        headers: {
          // Don't set Content-Type for FormData - browser will set it with boundary
          'x-api-key': API_KEY,
        },
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      setSessionId(data.sessionId);
      setStep('email');
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Failed to upload photo: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !sessionId) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/session/${sessionId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders(),
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.status}`);
      }

      setStep('success');
    } catch (err) {
      console.error('Email error:', err);
      setError('Failed to send email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('gender');
    setGender('');
    setSelectedFile(null);
    setPhotoPreview(null);
    setEmail('');
    setSessionId(null);
    setError('');
  };

  const handleSkip = async () => {
    if (sessionId) {
      try {
        await fetch(`${BACKEND_URL}/api/session/${sessionId}/skip`, {
          method: 'POST',
          headers: getApiHeaders(),
        });
      } catch (err) {
        console.error('Skip error:', err);
      }
    }
    handleReset();
  };

  return (
    <div className="App">
      <div className="status-bar">
        <div className="status-item">
          Connection: <span className={connectionStatus}>{connectionStatus}</span>
        </div>
        <div className="status-item">
          <a href="/" style={{ color: 'white', textDecoration: 'none' }}>
            ← Back to Main Display
          </a>
        </div>
      </div>

      <div className="container">
        <header className="header">
          <h1>Adidas Superstar</h1>
          <p>Photographer Manual Upload</p>
        </header>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {step === 'gender' && (
          <div className="step-container">
            <h2>Select Gender</h2>
            <div className="gender-buttons">
              <button 
                className="gender-button"
                onClick={() => handleGenderSelect('male')}
                disabled={isLoading}
              >
                MALE
              </button>
              <button 
                className="gender-button"
                onClick={() => handleGenderSelect('female')}
                disabled={isLoading}
              >
                FEMALE
              </button>
              <button 
                className="gender-button"
                onClick={() => handleGenderSelect('neutral')}
                disabled={isLoading}
              >
                NEUTRAL
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="step-container">
            <h2>Upload Photo</h2>
            <p>Selected: {gender.toUpperCase()}</p>
            
            <div className="upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                id="photo-upload"
                className="file-input"
              />
              <label htmlFor="photo-upload" className="upload-label">
                {photoPreview ? 'Change Photo' : 'Choose Photo'}
              </label>
            </div>

            {photoPreview && (
              <div className="photo-preview">
                <img src={photoPreview} alt="Preview" />
              </div>
            )}

            <div className="button-group">
              <button 
                className="secondary-button"
                onClick={() => setStep('gender')}
                disabled={isLoading}
              >
                Back
              </button>
              <button 
                className="primary-button"
                onClick={handleUpload}
                disabled={!selectedFile || isLoading}
              >
                {isLoading ? 'Uploading...' : 'Upload & Display'}
              </button>
            </div>
          </div>
        )}

        {step === 'email' && (
          <div className="step-container">
            <h2>Send Email</h2>
            <p>Photo is now displaying on monitors!</p>
            
            {photoPreview && (
              <div className="photo-preview-small">
                <img src={photoPreview} alt="Uploaded" />
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="email-form">
              <input
                type="email"
                placeholder="customer@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="email-input"
                required
              />
              
              <div className="button-group">
                <button 
                  type="button"
                  className="secondary-button"
                  onClick={handleSkip}
                  disabled={isLoading}
                >
                  Skip/Finish
                </button>
                <button 
                  type="submit"
                  className="primary-button"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div className="step-container">
            <h2>✅ Email Sent!</h2>
            <p>The personalized snapshot has been sent successfully.</p>
            
            <button 
              className="primary-button"
              onClick={handleReset}
            >
              New Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManualUpload;
