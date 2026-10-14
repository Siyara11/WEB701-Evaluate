import { json } from '@sveltejs/kit';
import { foods } from '$lib/store.js';

export function GET() {
  return json(foods);
}

export async function POST({ request }) {
  const body = await request.json();

  if (!body.name || !Number.isInteger(body.quantity) || body.quantity < 1)
    return json({ error: 'Valid name and positive quantity required' }, { status: 400 });

  const item = {
    id: Date.now(),
    name: body.name,
    quantity: body.quantity,
    tokens: body.tokens ?? 1
  };

  foods.push(item);
  return json(item, { status: 201 });
}