// routes/borrowings.js
// ---------------------------------------------------------------------------
// [R2] The interface members use to ACCEPT A TOKEN in a transaction.
//   GET  /api/borrowings              - my transactions (as borrower or lender)
//   POST /api/borrowings/:id/accept   - member accepts the token (JWT, member)
//   POST /api/borrowings/:id/decline  - member declines            (JWT, member)
//   POST /api/borrowings/:id/return   - member confirms the return (JWT, member)
// Every route needs a valid JWT, and the member's id is read from the token,
// so a member can only act on transactions for their own tools.
// ---------------------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const Borrowing = require('../models/Borrowing');
const Tool = require('../models/Tool');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify } = require('../utils/push');

const router = express.Router();
const LOAN_DAYS = 7;

// ---------- READ: my transactions ----------
router.get('/', requireAuth, async (req, res) => {
  const list = await Borrowing.find({ $or: [{ borrower: req.user.id }, { lender: req.user.id }] })
    .populate('tool', 'name category')
    .populate('borrower', 'fullName')
    .populate('lender', 'fullName')
    .sort({ createdAt: -1 });
  res.json(list);
});

// Helper: load a pending/active transaction that belongs to this member
async function loadOwn(req, res, status) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' });
    return null;
  }
  const b = await Borrowing.findOne({ _id: req.params.id, lender: req.user.id, status });
  if (!b) res.status(404).json({ error: `No ${status} transaction with this id for your tools` });
  return b;
}

// ---------- ACCEPT THE TOKEN ----------
router.post('/:id/accept', requireAuth, requireRole('member'), async (req, res) => {
  const b = await loadOwn(req, res, 'pending');
  if (!b) return;

  // Step 1 - take the tokens from the beneficiary. The filter
  // { tokenBalance: { $gte: cost } } makes this atomic: MongoDB only
  // subtracts if the balance is still high enough, so it can never go negative.
  const borrower = await User.findOneAndUpdate(
    { _id: b.borrower, tokenBalance: { $gte: b.tokensSpent } },
    { $inc: { tokenBalance: -b.tokensSpent } },
    { new: true }
  );
  if (!borrower) {
    // Beneficiary spent their tokens elsewhere - decline and free the tool
    b.status = 'declined';
    await b.save();
    await Tool.updateOne({ _id: b.tool }, { status: 'available' });
    return res.status(400).json({ error: 'Beneficiary no longer has enough tokens; request declined' });
  }

  // Step 2 - credit the token to the member who accepted it
  const member = await User.findByIdAndUpdate(req.user.id, { $inc: { tokenBalance: b.tokensSpent } }, { new: true });

  // Step 3 - mark the tool as borrowed and the transaction as active
  await Tool.updateOne({ _id: b.tool }, { status: 'borrowed' });
  b.status = 'active';
  b.acceptedAt = new Date();
  b.dueDate = new Date(Date.now() + LOAN_DAYS * 24 * 60 * 60 * 1000);
  await b.save();

  // [PWA] Tell the beneficiary on their phone that the token was accepted
  notify({ user: b.borrower }, { title: 'Token accepted', body: 'Your borrow request was accepted. Collect your tool!', url: '/' });

  res.json({
    message: 'Token accepted',
    transaction: b,
    borrowerTokenBalance: borrower.tokenBalance,
    memberTokenBalance: member.tokenBalance
  });
});

// ---------- DECLINE ----------
router.post('/:id/decline', requireAuth, requireRole('member'), async (req, res) => {
  const b = await loadOwn(req, res, 'pending');
  if (!b) return;
  b.status = 'declined';
  await b.save();
  await Tool.updateOne({ _id: b.tool }, { status: 'available' }); // back in the catalogue
  res.json({ message: 'Request declined', transaction: b });
});

// ---------- CONFIRM RETURN ----------
router.post('/:id/return', requireAuth, requireRole('member'), async (req, res) => {
  const b = await loadOwn(req, res, 'active');
  if (!b) return;
  b.status = 'returned';
  b.returnedAt = new Date();
  await b.save();
  await Tool.updateOne({ _id: b.tool }, { status: 'available' });
  res.json({ message: 'Tool returned and available again', transaction: b });
});

module.exports = router;
