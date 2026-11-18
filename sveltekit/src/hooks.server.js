// src/hooks.server.js
// ---------------------------------------------------------------------------
// [R1] SvelteKit runs handle() before every request. Here it decodes the JWT
// once and puts the user on event.locals, so each +server.js endpoint can
// check who is calling without repeating the token code (similar to Express
// middleware in MERN).
// ---------------------------------------------------------------------------
import { readUser } from '$lib/server/auth.js';

export async function handle({ event, resolve }) {
  event.locals.user = readUser(event.request); // null when no valid token
  return resolve(event);
}
