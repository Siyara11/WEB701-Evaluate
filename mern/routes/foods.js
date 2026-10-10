const express = require('express');
const router = express.Router();

let foods = [{ id: 1, name: 'Rice pack', quantity: 10, tokens: 1 }];

router.get('/', (req, res) => res.json(foods));

router.post('/', (req, res) => {
  const { name, quantity, tokens } = req.body;
  if (!name || !Number.isInteger(quantity) || quantity < 1)
    return res.status(400).json({ error: 'Valid name and positive quantity required' });

  const food = { id: Date.now(), name, quantity, tokens: tokens ?? 1 };
  foods.push(food);
  res.status(201).json(food);
});

module.exports = router;
module.exports.foods = foods;