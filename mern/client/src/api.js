// src/api.js
// ---------------------------------------------------------------------------
// [R1][R2][R3] Small wrapper around fetch() for calling the Express API.
// It adds the JWT to the Authorization header, so every protected request
// carries the user's identity (this is how JWT transfers state).
// ---------------------------------------------------------------------------
export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

  // The service worker adds X-From-Cache when it answered from the offline cache
  return { data, fromCache: res.headers.get('X-From-Cache') === 'true' };
}
