// seed.js
// ---------------------------------------------------------------------------
// [R3] Inserts demo data the first time the database is empty, so the
// catalogue has something to show. Runs once at start-up from server.js.
// Demo logins (password for both: Password123):
//   member@toolshed.nz       - Member (tool donor)
//   beneficiary@toolshed.nz  - Beneficiary (borrower, 5 tokens)
// ---------------------------------------------------------------------------
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Tool = require('./models/Tool');

module.exports = async function seed() {
  if (await User.estimatedDocumentCount()) return; // already has data

  const passwordHash = await bcrypt.hash('Password123', 10);
  const member = await User.create({ fullName: 'Aroha Member', email: 'member@toolshed.nz', passwordHash, role: 'member' });
  await User.create({ fullName: 'Ben Beneficiary', email: 'beneficiary@toolshed.nz', passwordHash, role: 'beneficiary' });

  await Tool.insertMany([
    { owner: member._id, name: 'Cordless Drill', category: 'Power Tools', description: '18V drill with two batteries', condition: 'Good' },
    { owner: member._id, name: 'Garden Spade', category: 'Garden', description: 'Full-size steel spade', condition: 'Well Loved' },
    { owner: member._id, name: 'Circular Saw', category: 'Power Tools', description: '185mm blade, safety guard', condition: 'Like New', tokenCost: 2 }
  ]);
  console.log('Seeded demo users and tools');
};
