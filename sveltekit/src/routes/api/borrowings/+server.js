// GET /api/borrowings
// [R2] Lists the logged-in user's token transactions (as borrower or lender).
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireUser } from '$lib/server/auth.js';

export async function GET({ locals }) {
  const me = toId(requireUser(locals).id);
  const db = await getDb();
  const list = await db.collection('borrowings')
    .find({ $or: [{ borrower: me }, { lender: me }] })
    .sort({ createdAt: -1 })
    .toArray();
  return json(list);
}
