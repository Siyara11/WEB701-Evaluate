// POST /api/borrowings/[id]/accept
// [R2] The interface a member uses to ACCEPT A TOKEN in a transaction.
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireRole } from '$lib/server/auth.js';

export async function POST({ params, locals }) {
  const member = requireRole(locals, 'member');
  const db = await getDb();
  const users = db.collection('users');

  // Only a pending transaction for one of this member's own tools can be accepted
  const b = await db.collection('borrowings').findOne({ _id: toId(params.id), lender: toId(member.id), status: 'pending' });
  if (!b) return json({ error: 'No pending transaction with this id for your tools' }, { status: 404 });

  // 1. Take the tokens - the $gte condition makes the check-and-subtract atomic
  const taken = await users.findOneAndUpdate(
    { _id: b.borrower, tokenBalance: { $gte: b.tokensSpent } },
    { $inc: { tokenBalance: -b.tokensSpent } },
    { returnDocument: 'after' }
  );
  if (!taken) {
    await db.collection('borrowings').updateOne({ _id: b._id }, { $set: { status: 'declined' } });
    await db.collection('tools').updateOne({ _id: b.tool }, { $set: { status: 'available' } });
    return json({ error: 'Beneficiary no longer has enough tokens; request declined' }, { status: 400 });
  }

  // 2. Credit the member, 3. lend the tool, 4. activate the transaction
  await users.updateOne({ _id: b.lender }, { $inc: { tokenBalance: b.tokensSpent } });
  await db.collection('tools').updateOne({ _id: b.tool }, { $set: { status: 'borrowed' } });
  const acceptedAt = new Date();
  const dueDate = new Date(acceptedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  await db.collection('borrowings').updateOne({ _id: b._id }, { $set: { status: 'active', acceptedAt, dueDate } });

  return json({
    message: 'Token accepted',
    transaction: { ...b, status: 'active', acceptedAt, dueDate },
    borrowerTokenBalance: taken.tokenBalance
  });
}
