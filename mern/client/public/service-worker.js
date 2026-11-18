// service-worker.js
// ---------------------------------------------------------------------------
// [PWA] Service worker for the Nelson Community Tool Shed.
// A service worker is a script the browser runs in the background, separate
// from the web page. It sits between the page and the network, so it can
// answer requests from a cache when there is no internet connection.
//
// This file applies the PWA in FOUR situations on the website:
//   1. Offline browsing   - app shell + tool catalogue are cached, so the
//                           catalogue and token balance still show offline.
//   2. Install to home screen - together with manifest.webmanifest, a
//                           registered service worker with a fetch handler
//                           makes the site installable (see src/pwa.js).
//   3. Push notifications - shows "new tool listed", "borrow request" and
//                           "token accepted" messages sent by the server.
//   4. Background sync    - a borrow request made while offline is queued
//                           in IndexedDB and sent automatically when the
//                           connection returns.
// ---------------------------------------------------------------------------

const VERSION = 'v2';
const SHELL_CACHE = `toolshed-shell-${VERSION}`; // HTML, JS, CSS, icons
const DATA_CACHE = `toolshed-data-${VERSION}`; // API responses (GET only)
const SHELL_FILES = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

// ===================== 1. INSTALL: pre-cache the app shell =====================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_FILES);
      // Vite gives the built JS/CSS hashed names (e.g. /assets/index-a1b2.js).
      // Read index.html and cache every /assets/ file it links to, so the
      // whole React app can start with no network.
      try {
        const html = await (await fetch('/index.html')).text();
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll(assets);
      } catch (e) {
        /* development mode has no /assets folder - ignore */
      }
      self.skipWaiting(); // activate the new version immediately
    })()
  );
});

// ===================== ACTIVATE: delete old caches =====================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => ![SHELL_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim(); // control pages that are already open
    })()
  );
});

// ===================== FETCH: choose a caching strategy per request =====================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore other websites

  // 4. Background sync - borrow requests made while offline
  if (req.method === 'POST' && /^\/api\/tools\/[^/]+\/borrow$/.test(url.pathname)) {
    event.respondWith(borrowWithOfflineQueue(req));
    return;
  }

  if (req.method !== 'GET') return; // other writes always go to the network

  // 1a. API data (catalogue, my account, my transactions): NETWORK FIRST.
  //     Fresh data when online; the last saved copy when offline.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/push')) return;
    event.respondWith(networkFirst(req));
    return;
  }

  // 1b. Page navigations: try the network, fall back to the cached shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html')) || caches.match('/offline.html'))
    );
    return;
  }

  // 1c. Static files (JS, CSS, icons): CACHE FIRST - they rarely change
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});

async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()); // save the latest copy for offline use
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreVary: true });
    if (cached) {
      // Add a header so the React app can show "showing saved data (offline)"
      const headers = new Headers(cached.headers);
      headers.set('X-From-Cache', 'true');
      return new Response(await cached.blob(), { status: 200, headers });
    }
    return new Response(JSON.stringify({ error: 'You are offline and this data has not been saved yet' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===================== 4. BACKGROUND SYNC: offline borrow queue =====================
// IndexedDB is a small database inside the browser. We use it to store the
// borrow request (URL + JWT header) until the device is online again.
function openQueue() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('toolshed-queue', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('borrows', { keyPath: 'id', autoIncrement: true });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function queueOp(mode, fn) {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('borrows', mode);
    const result = fn(tx.objectStore('borrows'));
    tx.oncomplete = () => resolve(result.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function borrowWithOfflineQueue(req) {
  const copy = req.clone();
  try {
    return await fetch(req); // online: send immediately
  } catch {
    // Offline: save the request and ask the browser to sync later
    await queueOp('readwrite', (store) =>
      store.add({ url: copy.url, auth: copy.headers.get('Authorization'), queuedAt: Date.now() })
    );
    try {
      // Background Sync is only in Chromium browsers and can be blocked by
      // settings; if it is unavailable, pwa.js replays the queue on "online".
      if (self.registration.sync) await self.registration.sync.register('sync-borrows');
    } catch (e) {
      /* fall back to the "online" message from the page */
    }
    return new Response(JSON.stringify({ queued: true, message: 'You are offline. Your borrow request will be sent when you reconnect.' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function replayQueue() {
  const items = await queueOp('readonly', (store) => store.getAll());
  for (const item of items || []) {
    try {
      const res = await fetch(item.url, { method: 'POST', headers: { Authorization: item.auth } });
      await queueOp('readwrite', (store) => store.delete(item.id)); // sent (or rejected) - remove it
      const body = await res.json().catch(() => ({}));
      await self.registration.showNotification('Tool Shed', {
        body: res.ok ? 'Your offline borrow request has been sent.' : `Borrow request failed: ${body.error || res.status}`,
        icon: '/icons/icon-192.png'
      });
    } catch {
      break; // still offline - try again at the next sync
    }
  }
}

// Fired by the browser when connectivity returns (Chrome, Edge, Android)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-borrows') event.waitUntil(replayQueue());
});
// Fallback for browsers without Background Sync (Firefox, Safari):
// the page posts this message when the window "online" event fires.
self.addEventListener('message', (event) => {
  if (event.data === 'replay-queue') event.waitUntil(replayQueue());
  if (event.data === 'clear-data-cache') event.waitUntil(caches.delete(DATA_CACHE)); // on logout
});

// ===================== 3. PUSH NOTIFICATIONS =====================
// The server (utils/push.js) sends an encrypted message through the push
// service; the browser wakes this worker up and fires the "push" event.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Tool Shed', body: 'You have an update' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

// Clicking the notification focuses an open Tool Shed window or opens a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(event.notification.data.url);
    })()
  );
});
