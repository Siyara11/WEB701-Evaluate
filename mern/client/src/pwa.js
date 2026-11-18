// src/pwa.js
// ---------------------------------------------------------------------------
// [PWA] Browser-side helpers used by the React app:
//   registerServiceWorker() - installs /service-worker.js
//   listenForInstall()      - captures the "beforeinstallprompt" event so we
//                             can show our own "Install app" button
//   enablePush(token)       - asks permission and subscribes to push messages
//   watchConnection()       - reports online/offline and replays the queue
// ---------------------------------------------------------------------------

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null; // very old browser
  // Scope "/" means the worker controls every page of the site
  return navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
}

// ---------- Install to home screen ----------
let deferredPrompt = null;
export function listenForInstall(onChange) {
  // Chrome/Edge/Android fire this when the manifest + service worker checks pass.
  // preventDefault() stops the mini-infobar so we can show our own button.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    onChange(true);
  });
  // Fired after the user installs the app
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onChange(false);
  });
}
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt(); // shows the browser's install dialog
  const { outcome } = await deferredPrompt.userChoice; // "accepted" or "dismissed"
  deferredPrompt = null;
  return outcome;
}
// True when the site is already running as an installed app
export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// ---------- Push notifications ----------
// The VAPID public key is Base64URL text; PushManager needs raw bytes.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(jwt) {
  if (!('PushManager' in window)) throw new Error('Push is not supported in this browser');
  // 1. Ask the user for permission (must be triggered by a click)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  // 2. Get the server's public key and subscribe through the service worker
  const { publicKey } = await (await fetch('/api/push/public-key')).json();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true, // every push must show a visible notification
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  // 3. Save the subscription on the server against this user (JWT protected)
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(sub)
  });
  return true;
}

// ---------- Online / offline ----------
export function watchConnection(onChange) {
  const update = () => {
    onChange(navigator.onLine);
    // Browsers without Background Sync: ask the worker to send queued borrows now
    if (navigator.onLine && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage('replay-queue');
    }
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  onChange(navigator.onLine);
}
