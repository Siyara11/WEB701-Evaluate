// POST /api/auth/login
// [R1] Checks the password against the bcrypt hash in MongoDB and returns a JWT.
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb, publicUser } from '$lib/server/db.js';
import { createToken } from '$lib/server/auth.js';

export async function POST({ request }) {
  const { email, password } = await request.json();
  const db = await getDb();
  const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() });

  // One generic message for unknown email or wrong password
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }
  // The client stores this token and sends it as "Authorization: Bearer <token>"
  return json({ token: createToken(user), user: publicUser(user) });
}
