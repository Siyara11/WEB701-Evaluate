// routes/tools.js
// ---------------------------------------------------------------------------
// [R3] Store and retrieve the charity's products (tools) in MongoDB.
//   GET  /api/tools               - public catalogue (optionally ?category=&q=)
//   GET  /api/tools/:id           - one tool with the owner's name
//   POST /api/tools               - a member lists a new tool   (JWT, member)
//   PUT  /api/tools/:id           - owner edits their tool      (JWT, member)
//   DELETE /api/tools/:id         - owner removes their tool    (JWT, member)
// [R2] Start a token transaction:
//   POST /api/tools/:id/borrow    - a beneficiary offers tokens (JWT, beneficiary)
// ---------------------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const Tool = require('../models/Tool');
const User = require('../models/User');
const Borrowing = require('../models/Borrowing');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Reject ids that are not valid MongoDB ObjectIds before querying
const validId = (id) => mongoose.isValidObjectId(id);

// ---------- READ: catalogue ----------
router.get('/', async (req, res) => {
  // Build a MongoDB filter from the query string so beneficiaries can
  // search and filter the catalogue, e.g. /api/tools?category=Garden&q=saw
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    // Escape regex special characters so user input is treated as plain text
    const safe = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: safe, $options: 'i' }; // case-insensitive search
  }

  // populate() replaces the owner ObjectId with the owner's name (like an SQL JOIN)
  const tools = await Tool.find(filter).populate('owner', 'fullName').sort({ createdAt: -1 });
  res.json(tools);
});

// ---------- READ: single tool ----------
router.get('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const tool = await Tool.findById(req.params.id).populate('owner', 'fullName');
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool);
});

// ---------- CREATE: member lists a tool ----------
router.post('/', requireAuth, requireRole('member', 'admin'), async (req, res) => {
  try {
    const { name, category, description, condition, tokenCost } = req.body;
    // The owner is taken from the verified JWT, so nobody can list a tool
    // in another member's name. Mongoose validates the rest against the schema.
    const tool = await Tool.create({
      owner: req.user.id,
      name,
      category,
      description,
      condition,
      tokenCost
    });

    res.status(201).json(tool);
  } catch (err) {
    // ValidationError (e.g. missing name) -> 400 Bad Request
    res.status(400).json({ error: err.message });
  }
});

// ---------- UPDATE: owner edits a tool ----------
router.put('/:id', requireAuth, requireRole('member', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const allowed = ['name', 'category', 'description', 'condition', 'tokenCost', 'status'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  // The filter includes owner: req.user.id so members can only edit their own tools
  const tool = await Tool.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, updates, {
    new: true,
    runValidators: true
  });
  if (!tool) return res.status(404).json({ error: 'Tool not found or not yours' });
  res.json(tool);
});

// ---------- DELETE: owner removes a tool ----------
router.delete('/:id', requireAuth, requireRole('member', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await Tool.deleteOne({ _id: req.params.id, owner: req.user.id, status: 'available' });
  if (!result.deletedCount) return res.status(404).json({ error: 'Tool not found, not yours, or currently on loan' });
  res.json({ message: 'Tool removed' });
});

// ---------- [R2] BORROW REQUEST: beneficiary offers a token ----------
router.post('/:id/borrow', requireAuth, requireRole('beneficiary'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  const borrower = await User.findById(req.user.id);
  const toolBefore = await Tool.findById(req.params.id);
  if (!toolBefore) return res.status(404).json({ error: 'Tool not found' });

  // Check the beneficiary has enough tokens BEFORE reserving the tool
  if (borrower.tokenBalance < toolBefore.tokenCost) {
    return res.status(400).json({ error: 'Not enough tokens', tokenBalance: borrower.tokenBalance });
  }

  // Atomic update: only changes status if it is still "available". If two
  // people click Borrow at the same moment, only one update matches.
  const tool = await Tool.findOneAndUpdate(
    { _id: req.params.id, status: 'available' },
    { status: 'requested' },
    { new: true }
  );
  if (!tool) return res.status(409).json({ error: 'Tool is not available' });

  // Record the pending token transaction. Tokens are NOT deducted yet:
  // the member must accept the token first (see routes/borrowings.js).
  const borrowing = await Borrowing.create({
    tool: tool._id,
    borrower: borrower._id,
    lender: tool.owner,
    tokensSpent: tool.tokenCost
  });

  res.status(201).json({ message: 'Borrow request sent - waiting for the member to accept the token', borrowing });
});

module.exports = router;
