import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import { AuthProvider } from './lib/auth.js';
import { initPixel } from './lib/track.js';
import './styles.css';

// Load the Meta Pixel once (no-op without VITE_META_PIXEL_ID). Route-change
// PageViews are fired from inside App via useLocation.
initPixel();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
