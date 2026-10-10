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