<<<<<<< HEAD
// server.js
// ---------------------------------------------------------------------------
// Entry point of the MEAN prototype for the Nelson Community Tool Shed.
// MEAN = MongoDB, Express, Angular, Node.js. The back end is the same kind
// of Express + Mongoose REST API as MERN; only the front end changes
// (Angular instead of React). An Angular app would call these endpoints with
// HttpClient and attach the JWT with an HttpInterceptor. Runs on port 5001
// with its own database (toolshed_mean) so it can run beside MERN.
// ---------------------------------------------------------------------------
require('dotenv').config(); // loads PORT, MONGO_URI, JWT_SECRET from .env
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seed = require('./seed');

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set in .env - using an insecure development secret');
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
}

const app = express();
app.use(cors()); // allows the Angular dev server (ng serve, port 4200) to call this API
app.use(express.json()); // parses JSON request bodies into req.body

// ---- API routes (each file is commented with the requirement it meets) ----
app.use('/api/auth', require('./routes/auth')); // [R1] register / login / own account
app.use('/api/tools', require('./routes/tools')); // [R3] store & retrieve tools, [R2] borrow request
app.use('/api/borrowings', require('./routes/borrowings')); // [R2] member accepts token

// Simple health check used to check the API is running
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Central error handler so an unexpected error returns JSON, not a crash
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5001;

// Connect to MongoDB first, then start listening
connectDB()
  .then(seed)
  .then(() => {
    app.listen(PORT, () => console.log(`MEAN Tool Shed API running on http://localhost:${PORT}`));
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 MEAN backend on port ${PORT}`));
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
