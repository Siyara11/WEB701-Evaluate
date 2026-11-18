<<<<<<< HEAD
// POST /api/auth/register
// [R1] File-based routing: the folder path api/auth/register IS the URL,
// and exporting a function called POST handles POST requests to it.
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb, publicUser } from '$lib/server/db.js';

export async function POST({ request }) {
  const { fullName, email, password, role } = await request.json();

  // Validate on the server - the browser cannot be trusted
  if (!fullName || !email || !password || password.length < 8) {
    return json({ error: 'fullName, email and a password of 8+ characters are required' }, { status: 400 });
  }

  const db = await getDb();
  const user = {
    fullName,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10), // salted hash, plain password never stored
    role: role === 'member' ? 'member' : 'beneficiary', // admin cannot self-register
    tokenBalance: 5,
    createdAt: new Date()
  };

  try {
    const { insertedId } = await db.collection('users').insertOne(user);
    return json({ message: 'Registered', user: publicUser({ _id: insertedId, ...user }) }, { status: 201 });
  } catch (e) {
    // Error code 11000 = the unique email index rejected a duplicate
    if (e.code === 11000) return json({ error: 'Email already registered' }, { status: 409 });
    throw e;
  }
}
=======
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { users } from '$lib/auth.js';

export async function POST({ request }) {
  const { email, password, role } = await request.json();

  if (!email || !password)
    return json({ error: 'Email and password required' }, { status: 400 });

  if (users.find(u => u.email === email))
    return json({ error: 'Email already exists' }, { status: 400 });

  const user = {
    id: users.length + 1,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: role || 'beneficiary'
  };

  users.push(user);
  return json(
    { message: 'Registered', email: user.email, role: user.role },
    { status: 201 }
  );
}
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
