// models/Borrowing.js
// ---------------------------------------------------------------------------
// [R2][R3] Mongoose model for the "borrowings" collection. Each document is a
// token transaction between a beneficiary (borrower) and a member (lender).
// Lifecycle:  pending  -> member accepts the token -> active -> returned
//             pending  -> member declines           -> declined
// Keeping every transaction as its own document gives the charity an
// auditable history of who spent which tokens on which tool.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

const borrowingSchema = new mongoose.Schema(
  {
    tool: { type: mongoose.Schema.Types.ObjectId, ref: 'Tool', required: true },
    borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokensSpent: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'active', 'returned', 'declined'], default: 'pending' },
    acceptedAt: Date,
    dueDate: Date,
    returnedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Borrowing', borrowingSchema);
