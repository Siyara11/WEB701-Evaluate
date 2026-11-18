// models/User.js
// ---------------------------------------------------------------------------
// [R1][R3] Mongoose model for the "users" collection.
// Matches the users table designed in Milestone One: name, unique email,
// a bcrypt password hash (never the plain password), a role and a token
// balance. Members (tool donors) list tools; beneficiaries (borrowers)
// spend tokens to borrow them.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    // unique: true makes MongoDB build an index that rejects duplicate emails
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Role-based access control: what the user is allowed to do
    role: { type: String, enum: ['member', 'beneficiary', 'admin'], default: 'beneficiary' },
    // Every new beneficiary starts with 5 borrowing tokens (Milestone One design)
    tokenBalance: { type: Number, default: 5, min: 0 }
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// toJSON transform: strip the password hash whenever a user is sent to the client
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
