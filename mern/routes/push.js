// routes/push.js
// ---------------------------------------------------------------------------
// [PWA] Endpoints the React app uses to turn on push notifications.
//   GET  /api/push/public-key  - VAPID public key the browser needs to subscribe
//   POST /api/push/subscribe   - save this device's subscription (JWT)
//   POST /api/push/test        - send a test notification to myself (JWT)
// ---------------------------------------------------------------------------
const express = require('express');
const PushSubscription = require('../models/PushSubscription');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../utils/push');

const router = express.Router();

router.get('/public-key', (_req, res) => res.json({ publicKey: process.env.VAPID_PUBLIC_KEY }));

router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  // upsert: update the subscription if this endpoint is already stored, else insert it
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys, user: req.user.id },
    { upsert: true, new: true }
  );
  res.status(201).json({ message: 'Subscribed to notifications' });
});

router.post('/test', requireAuth, async (req, res) => {
  await notify({ user: req.user.id }, { title: 'Nelson Community Tool Shed', body: 'Notifications are working!', url: '/' });
  res.json({ message: 'Test notification sent' });
});

module.exports = router;
