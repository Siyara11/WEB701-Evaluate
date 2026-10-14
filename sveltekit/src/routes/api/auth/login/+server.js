import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { users, createToken } from '$lib/auth.js';

export async function POST({ request }) {
  const { email, password } = await request.json();
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return json({ error: 'Invalid credentials' }, { status: 400 });

  return json({
    token: createToken(user),
    role: user.role,
    email: user.email
  });
}