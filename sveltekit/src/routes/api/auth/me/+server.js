import { json } from '@sveltejs/kit';
import { verifyToken } from '$lib/auth.js';

export function GET({ request }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const payload = token && verifyToken(token);

  if (!payload) return json({ error: 'Unauthorized' }, { status: 401 });

  return json({
    id: payload.id,
    role: payload.role
  });
}