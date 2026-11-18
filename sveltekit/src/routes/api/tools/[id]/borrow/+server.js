// POST /api/tools/[id]/borrow
// [R2] A beneficiary offers tokens for a tool. The tokens are only moved when
// the member accepts (see /api/borrowings/[id]/accept).
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireRole } from '$lib/server/auth.js';

export async function POST({ params, locals }) {
  const me = requireRole(locals, 'beneficiary');
  const db = await getDb();
  const borrower = await db.collection('users').findOne({ _id: toId(me.id) });
  const tool = await db.collection('tools').findOne({ _id: toId(params.id) });
  if (!tool) return json({ error: 'Tool not found' }, { status: 404 });
  if (borrower.tokenBalance < tool.tokenCost) return json({ error: 'Not enough tokens' }, { status: 400 });

  // Atomic reserve: matches only while status is still "available"
  const reserved = await db.collection('tools').updateOne(
    { _id: tool._id, status: 'available' },
    { $set: { status: 'requested' } }
  );
  if (!reserved.modifiedCount) return json({ error: 'Tool is not available' }, { status: 409 });

  const borrowing = {
    tool: tool._id,
    borrower: borrower._id,
    lender: tool.owner,
    tokensSpent: tool.tokenCost,
    status: 'pending',
    createdAt: new Date()
  };
  const { insertedId } = await db.collection('borrowings').insertOne(borrowing);
  return json({ message: 'Borrow request sent', borrowing: { _id: insertedId, ...borrowing } }, { status: 201 });
}
