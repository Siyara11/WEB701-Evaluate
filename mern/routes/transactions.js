const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Share the foods array with foods.js
const foods = require('./foods').foods;

// ACCEPT TOKEN — redeems one item from stock
router.post('/accept/:foodId', authMiddleware, (req, res) => {
  const food = foods.find(f => f.id === Number(req.params.foodId));
  if (!food) return res.status(404).json({ error: 'Food not found' });
  if (food.quantity <= 0) return res.status(400).json({ error: 'Out of stock' });

  food.quantity -= 1;
  res.json({ message: 'Token accepted', food, acceptedBy: req.user.id });
});

module.exports = router;