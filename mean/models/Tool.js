// models/Tool.js
// ---------------------------------------------------------------------------
// [R3] Mongoose model for the "tools" collection - the products/services
// that charity members list on the website. "owner" is a reference to the
// User document of the member who listed the tool (like a foreign key).
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    category: { type: String, default: 'Hand Tools', trim: true },
    description: { type: String, default: '', maxlength: 1000 },
    condition: { type: String, enum: ['Like New', 'Good', 'Well Loved'], default: 'Good' },
    // status drives the catalogue: only "available" tools can be borrowed
    status: { type: String, enum: ['available', 'requested', 'borrowed', 'maintenance'], default: 'available' },
    // how many tokens a beneficiary must pay to borrow this tool
    tokenCost: { type: Number, default: 1, min: 1 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tool', toolSchema);
