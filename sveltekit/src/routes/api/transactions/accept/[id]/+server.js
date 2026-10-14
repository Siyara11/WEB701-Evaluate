import { json } from '@sveltejs/kit';
import { verifyToken } from '$lib/auth.js';
import { foods } from '$lib/store.js';

export async function POST({ request, params }) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const payload = token && verifyToken(token);

  if (!payload) return json({ error: 'Unauthorized' }, { status: 401 });

  const food = foods.find(f => f.id === Number(params.id));
  if (!food) return json({ error: 'Food not found' }, { status: 404 });
  if (food.quantity <= 0) return json({ error: 'Out of stock' }, { status: 400 });

  food.quantity -= 1;
  return json({
    message: 'Token accepted',
    food,
    acceptedBy: payload.id
  });
}