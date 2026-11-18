// POST /api/borrowings/[id]/return
// [R2] The member confirms the tool came back; it returns to the catalogue.
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireRole } from '$lib/server/auth.js';

export async function POST({ params, locals }) {
  const member = requireRole(locals, 'member');
  const db = await getDb();
  const b = await db.collection('borrowings').findOneAndUpdate(
    { _id: toId(params.id), lender: toId(member.id), status: 'active' },
    { $set: { status: 'returned', returnedAt: new Date() } }
  );
  if (!b) return json({ error: 'No active transaction with this id for your tools' }, { status: 404 });
  await db.collection('tools').updateOne({ _id: b.tool }, { $set: { status: 'available' } });
  return json({ message: 'Tool returned and available again' });
}
