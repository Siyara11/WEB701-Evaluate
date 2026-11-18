// GET / PUT / DELETE /api/tools/[id]
// [R3] The [id] folder name makes "id" a dynamic URL parameter (params.id).
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireRole } from '$lib/server/auth.js';

export async function GET({ params }) {
  const db = await getDb();
  const tool = await db.collection('tools').findOne({ _id: toId(params.id) });
  return tool ? json(tool) : json({ error: 'Tool not found' }, { status: 404 });
}

export async function PUT({ params, locals, request }) {
  const user = requireRole(locals, 'member');
  const body = await request.json();
  // Only copy fields that are allowed to change
  const set = {};
  for (const k of ['name', 'category', 'description', 'condition', 'tokenCost']) if (body[k] !== undefined) set[k] = body[k];
  const db = await getDb();
  // owner in the filter = members can only edit their own tools
  const tool = await db.collection('tools').findOneAndUpdate(
    { _id: toId(params.id), owner: toId(user.id) },
    { $set: set },
    { returnDocument: 'after' }
  );
  return tool ? json(tool) : json({ error: 'Tool not found or not yours' }, { status: 404 });
}

export async function DELETE({ params, locals }) {
  const user = requireRole(locals, 'member');
  const db = await getDb();
  const r = await db.collection('tools').deleteOne({ _id: toId(params.id), owner: toId(user.id), status: 'available' });
  return r.deletedCount ? json({ message: 'Tool removed' }) : json({ error: 'Tool not found, not yours, or on loan' }, { status: 404 });
}
