// models/PushSubscription.js
// ---------------------------------------------------------------------------
// [PWA] Stores the browser push subscriptions created by the service worker.
// A subscription is the URL + keys the browser vendor's push service gives
// us; the server uses it later to send a notification to that device even
// when the website is closed.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
