// src/main.jsx - React entry point
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { registerServiceWorker } from './pwa.js';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// [PWA] Register the service worker after the page has loaded so it does
// not slow down the first render.
window.addEventListener('load', () => {
  registerServiceWorker().catch((err) => console.error('Service worker registration failed', err));
});
