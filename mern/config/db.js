// config/db.js
// ---------------------------------------------------------------------------
// [R3] Connects the Express server to a real MongoDB database using Mongoose.
// Mongoose is an ODM (Object Document Mapper): it lets us describe each
// collection (users, tools, borrowings) as a schema and then read/write
// documents with JavaScript methods instead of hand-written queries.
// Data is persisted on disk by MongoDB, so it survives a server restart
// (this replaces the in-memory arrays used in the first prototype).
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

async function connectDB() {
  // The connection string comes from .env so it can point at a local
  // MongoDB server in development or MongoDB Atlas in production.
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/toolshed_mern';
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
