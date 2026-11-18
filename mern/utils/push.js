// utils/push.js
// ---------------------------------------------------------------------------
// [PWA] Server side of Web Push notifications.
// web-push signs each message with the VAPID private key so the browser's
// push service (Google FCM, Mozilla autopush, Apple) knows it came from us.
// The service worker in the browser receives the message and shows it,
// even if the Tool Shed tab is closed.
// ---------------------------------------------------------------------------
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let enabled = false;

function initPush() {
  let { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    // For a quick local demo we generate keys at start-up. They change on
    // every restart, so copy the printed keys into .env to keep them.
    const keys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    console.log('No VAPID keys in .env - generated temporary keys:');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}`);
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@toolshed.example', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  enabled = true;
}

// Send a notification to every saved subscription matching the filter.
// Example: notify({ user: lenderId }, {...}) or notify({}, {...}) for everyone.
async function notify(filter, payload) {
  if (!enabled) return;
  const subs = await PushSubscription.find(filter);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 404/410 means the user unsubscribed or the browser removed it - clean up
        if (err.statusCode === 404 || err.statusCode === 410) await s.deleteOne();
      }
    })
  );
}

module.exports = { initPush, notify };
