// src/lib/server/auth.js
// ---------------------------------------------------------------------------
// [R1][R2] JWT helpers for the SvelteKit prototype.
// hooks.server.js calls readUser() on EVERY request and stores the result in
// event.locals.user; endpoints then call requireUser()/requireRole().
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const SECRET = () => env.JWT_SECRET || 'dev-only-secret-change-me';

// Sign a token containing the user id and role, valid for one hour
export function createToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, SECRET(), { expiresIn: '1h' });
}

// Read "Authorization: Bearer <token>"; return the payload or null
export function readUser(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), SECRET()); // checks signature and expiry
  } catch {
    return null;
  }
}

// throw error(...) stops the endpoint and SvelteKit returns that status as JSON
export function requireUser(locals) {
  if (!locals.user) throw error(401, 'Login required: send a valid Bearer token');
  return locals.user;
}

export function requireRole(locals, ...roles) {
  const user = requireUser(locals);
  if (!roles.includes(user.role)) throw error(403, `Only ${roles.join(' or ')} accounts can do this`);
  return user;
}
