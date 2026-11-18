<<<<<<< HEAD
// routes/auth.js
// ---------------------------------------------------------------------------
// [R1] Register, log in and administer your own account using JWT.
//   POST /api/auth/register  - create an account (password hashed with bcrypt)
//   POST /api/auth/login     - check the password and return a signed JWT
//   GET  /api/auth/me        - view own account          (JWT required)
//   PUT  /api/auth/me        - update own name/password  (JWT required)
// ---------------------------------------------------------------------------
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: build the JWT. The payload carries the user id and role so the
// server does not need to keep a session; it expires after one hour.
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });
}

// ---------- REGISTER ----------
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Basic server-side validation - never trust input from the browser
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Only "member" or "beneficiary" can self-register; admin is never accepted from the client
    const safeRole = role === 'member' ? 'member' : 'beneficiary';

    // Check the database for an existing account with this email
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // bcrypt.hash adds a random salt and hashes the password 2^10 times,
    // so the real password is never stored in MongoDB.
    const passwordHash = await bcrypt.hash(password, 10);

    // User.create inserts a new document into the "users" collection
    const user = await User.create({ fullName, email, passwordHash, role: safeRole });

    res.status(201).json({ message: 'Registered', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Look the user up in MongoDB by email
    const user = await User.findOne({ email: (email || '').toLowerCase() });

    // bcrypt.compare hashes the supplied password with the stored salt and
    // compares the result. The same message is used for "no user" and
    // "wrong password" so attackers cannot discover which emails exist.
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Success: return the signed JWT. The React client stores it and sends
    // it in the Authorization header on every protected request.
    res.json({ token: signToken(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- VIEW OWN ACCOUNT (protected) ----------
// requireAuth runs first; it verifies the JWT and puts { id, role } on req.user
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ---------- ADMINISTER OWN ACCOUNT (protected) ----------
// A user can only ever change their own record, because the id comes from
// the verified token, not from the request body or URL.
router.put('/me', requireAuth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.fullName) updates.fullName = req.body.fullName;
    if (req.body.password) {
      if (req.body.password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }
    // { new: true } returns the document after the update has been saved
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    res.json({ message: 'Account updated', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
=======
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// In-memory user store for proof of concept
const users = [];

// REGISTER
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  if (users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: users.length + 1, email, password: hashed, role: role || 'beneficiary' };
  users.push(user);
  res.status(201).json({ message: 'Registered', email: user.email, role: user.role });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, role: user.role },
                          process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, role: user.role, email: user.email });
});

// GET /me — admin own account (protected)
router.get('/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, email: user.email, role: user.role });
});

module.exports = router;
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
