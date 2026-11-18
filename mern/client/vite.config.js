// vite.config.js
// Vite builds the React app. During development (npm run dev, port 5173)
// the proxy forwards /api calls to the Express server on port 5000, so the
// browser sees one origin and the service worker can cache API responses.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' }
  }
});
