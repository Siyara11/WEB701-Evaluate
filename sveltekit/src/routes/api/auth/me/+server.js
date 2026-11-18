// GET + PUT /api/auth/me
// [R1] View and administer your own account. requireUser() returns 401 when
// there is no valid JWT; the user id always comes from the verified token.
import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { getDb, toId, publicUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/auth.js';

export async function GET({ locals }) {
  const { id } = requireUser(locals);
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: toId(id) });
  if (!user) return json({ error: 'User not found' }, { status: 404 });
  return json(publicUser(user));
}

export async function PUT({ locals, request }) {
  const { id } = requireUser(locals);
  const body = await request.json();
  const set = {};
  if (body.fullName) set.fullName = body.fullName;
  if (body.password) {
    if (body.password.length < 8) return json({ error: 'Password must be 8+ characters' }, { status: 400 });
    set.passwordHash = await bcrypt.hash(body.password, 10);
  }
  const db = await getDb();
  // $set changes only the listed fields; returnDocument 'after' gives the updated user
  const user = await db.collection('users').findOneAndUpdate({ _id: toId(id) }, { $set: set }, { returnDocument: 'after' });
  return json({ message: 'Account updated', user: publicUser(user) });
}
