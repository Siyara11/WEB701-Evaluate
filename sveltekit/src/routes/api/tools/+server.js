// GET + POST /api/tools
// [R3] Store and retrieve the charity's tools in MongoDB.
import { json } from '@sveltejs/kit';
import { getDb, toId } from '$lib/server/db.js';
import { requireRole } from '$lib/server/auth.js';

const CONDITIONS = ['Like New', 'Good', 'Well Loved'];

// Public catalogue with optional search: /api/tools?q=drill&category=Garden
export async function GET({ url }) {
  const filter = {};
  const q = url.searchParams.get('q');
  const category = url.searchParams.get('category');
  if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; // escaped search text
  if (category) filter.category = category;
  const db = await getDb();
  const tools = await db.collection('tools').find(filter).sort({ createdAt: -1 }).toArray();
  return json(tools);
}

// A member lists a new tool (JWT + member role required)
export async function POST({ locals, request }) {
  const user = requireRole(locals, 'member');
  const body = await request.json();

  // No schema library here, so validation is written by hand
  if (!body.name || body.name.trim().length < 2) return json({ error: 'Tool name (2+ characters) is required' }, { status: 400 });
  const tokenCost = Number.isInteger(body.tokenCost) && body.tokenCost > 0 ? body.tokenCost : 1;

  const tool = {
    owner: toId(user.id), // from the token, not the body
    name: body.name.trim(),
    category: body.category || 'Hand Tools',
    description: body.description || '',
    condition: CONDITIONS.includes(body.condition) ? body.condition : 'Good',
    status: 'available',
    tokenCost,
    createdAt: new Date()
  };
  const db = await getDb();
  const { insertedId } = await db.collection('tools').insertOne(tool);
  return json({ _id: insertedId, ...tool }, { status: 201 });
}
