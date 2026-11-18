<<<<<<< HEAD
// server.js
// ---------------------------------------------------------------------------
// Entry point of the MERN prototype for the Nelson Community Tool Shed.
// Node.js runs this file; Express provides routing and middleware; Mongoose
// connects to MongoDB; the built React PWA (client/dist) is served as static
// files so the website and the API share one origin (needed by the service
// worker to cache API responses for offline use).
// ---------------------------------------------------------------------------
require('dotenv').config(); // loads PORT, MONGO_URI, JWT_SECRET, VAPID keys from .env
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initPush } = require('./utils/push');
const seed = require('./seed');

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set in .env - using an insecure development secret');
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
}

const app = express();
app.use(cors()); // allows the Vite dev server (port 5173) to call this API
app.use(express.json()); // parses JSON request bodies into req.body

// ---- API routes (each file is commented with the requirement it meets) ----
app.use('/api/auth', require('./routes/auth')); // [R1] register / login / own account
app.use('/api/tools', require('./routes/tools')); // [R3] store & retrieve tools, [R2] borrow request
app.use('/api/borrowings', require('./routes/borrowings')); // [R2] member accepts token
app.use('/api/push', require('./routes/push')); // [PWA] push notifications

// Simple health check used by the service worker to detect "back online"
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- Serve the React PWA after `npm run client:build` ----
const dist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // Any non-API route returns index.html so React can handle routing
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Central error handler so an unexpected error returns JSON, not a crash
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start listening
connectDB()
  .then(seed)
  .then(() => {
    initPush();
    app.listen(PORT, () => console.log(`MERN Tool Shed API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
=======
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/foods', require('./routes/foods'));
app.use('/api/transactions', require('./routes/transactions'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 MERN server on port ${PORT}`));
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
