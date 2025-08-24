# Adidas Superstar Experience - Frontend

React frontend for monitor displays in the interactive store experience.

## Features

- **Fullscreen Grid Display**: Responsive layout for multiple monitors
- **Image Preloading**: All outfit images loaded into RAM on startup
- **Real-time Updates**: Server-Sent Events (SSE) for instant state changes
- **Dual Modes**: 
  - Idle: Random outfit rotation every 10s
  - Session: User photo + selected outfits display
- **Zero Bandwidth Operation**: No image refetching after initial load

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure backend URL in `.env`:
   ```
   REACT_APP_BACKEND_URL=http://localhost:3001
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open browser in fullscreen and arrange across monitors

## How It Works

### Idle Mode
- Displays random outfit combinations
- Static logos always visible in corners
- Outfits change every 10 seconds
- All selections happen client-side from cached images

### Session Mode
- Triggered by SSE event from backend
- Shows user photo in center
- Displays selected outfit combinations
- Returns to idle after email sent or timeout

### Image Management
- All images preloaded on app startup
- Stored as Image objects in React state
- Organized by gender and part type
- Zero network requests during operation

## Grid Layout

```
┌─────────────┬─────────────┬─────────────┐
│ Logo Left   │ Top Outfit  │ Logo Right  │
├─────────────┼─────────────┼─────────────┤
│ Left Outfit │ User Photo  │ Right Outfit│
├─────────────┼─────────────┼─────────────┤
│ Bottom      │ Shoes       │ Bottom      │
└─────────────┴─────────────┴─────────────┘
```

## File Structure

```
src/
├── App.js              # Main application component
├── App.css             # Responsive grid styling
└── index.js            # Application entry point
```

## Browser Setup

1. Open `http://localhost:3000` in fullscreen
2. Use browser tools or OS features to split across monitors
3. The single page will display the grid across all screens
