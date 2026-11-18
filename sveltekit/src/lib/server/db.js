// src/lib/server/db.js
// ---------------------------------------------------------------------------
// [R3] MongoDB connection for the SvelteKit prototype, using the official
// "mongodb" Node.js driver (no ODM this time, to compare with Mongoose in MERN).
// Files inside src/lib/server can only run on the server, so the database
// URL and secrets can never be bundled into browser code.
// ---------------------------------------------------------------------------
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private'; // reads .env at runtime

const client = new MongoClient(env.MONGO_URI || 'mongodb://127.0.0.1:27017/toolshed_svelte');
let dbPromise;

// Connect once and reuse the same connection for every request
export function getDb() {
  if (!dbPromise) {
    dbPromise = client.connect().then(async (c) => {
      const db = c.db();
      // A unique index stops two accounts using the same email
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await seed(db);
      return db;
    });
  }
  return dbPromise;
}

// Convert a URL parameter to an ObjectId, or null if it is not a valid id
export function toId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// Hide the password hash before sending a user to the browser
export function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// Demo data the first time the database is empty (password: Password123)
async function seed(db) {
  if (await db.collection('users').estimatedDocumentCount()) return;
  const passwordHash = await bcrypt.hash('Password123', 10);
  const { insertedId: memberId } = await db.collection('users').insertOne({
    fullName: 'Aroha Member', email: 'member@toolshed.nz', passwordHash, role: 'member', tokenBalance: 5, createdAt: new Date()
  });
  await db.collection('users').insertOne({
    fullName: 'Ben Beneficiary', email: 'beneficiary@toolshed.nz', passwordHash, role: 'beneficiary', tokenBalance: 5, createdAt: new Date()
  });
  await db.collection('tools').insertMany([
    { owner: memberId, name: 'Cordless Drill', category: 'Power Tools', description: '', condition: 'Good', status: 'available', tokenCost: 1, createdAt: new Date() },
    { owner: memberId, name: 'Garden Spade', category: 'Garden', description: '', condition: 'Well Loved', status: 'available', tokenCost: 1, createdAt: new Date() }
  ]);
}
