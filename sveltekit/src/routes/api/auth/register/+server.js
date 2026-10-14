import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { users } from '$lib/auth.js';

export async function POST({ request }) {
  const { email, password, role } = await request.json();

  if (!email || !password)
    return json({ error: 'Email and password required' }, { status: 400 });

  if (users.find(u => u.email === email))
    return json({ error: 'Email already exists' }, { status: 400 });

  const user = {
    id: users.length + 1,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: role || 'beneficiary'
  };

  users.push(user);
  return json(
    { message: 'Registered', email: user.email, role: user.role },
    { status: 201 }
  );
}