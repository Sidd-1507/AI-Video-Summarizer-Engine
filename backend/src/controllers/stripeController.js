'use strict';

const { grantCredits } = require('../services/creditService');
const { PACKAGES } = require('./creditsController');

function resolvePackage(priceId) {
  if (!priceId || typeof priceId !== 'string') return null;
  const byAlias = PACKAGES.find((p) => p.id === priceId);
  if (byAlias) return byAlias;
  return PACKAGES.find((p) => process.env[p.env] && process.env[p.env] === priceId) || null;
}

function frontendOrigin() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function createStripeController({ stripe, UserModel }) {

  async function createCheckout(req, res) {
    try {
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: 'priceId is required' });

      const pkg = resolvePackage(priceId);
      if (!pkg) return res.status(400).json({ error: 'Invalid priceId' });

      const user = await UserModel.findById(req.user.id).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const envPrice = process.env[pkg.env];
      const line_items = envPrice
        ? [{ price: envPrice, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              unit_amount: pkg.priceUsd * 100,
              product_data: { name: `${pkg.credits} credits` },
            },
            quantity: 1,
          }];

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items,
        success_url: `${frontendOrigin()}/billing?success=true`,
        cancel_url: `${frontendOrigin()}/billing?cancelled=true`,
        metadata: {
          userId: req.user.id,
          creditsAwarded: pkg.credits.toString(),
        },
        customer_email: user.email,
      });

      return res.json({ url: session.url });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  async function webhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      const raw = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, creditsAwarded } = session.metadata || {};

      if (!userId || !creditsAwarded) {
        console.error('[Stripe] Webhook missing metadata:', session.id);
        return res.json({ received: true });
      }

      try {
        await grantCredits(UserModel, userId, parseInt(creditsAwarded, 10), 'purchase');
      } catch (err) {
        console.error('[Stripe] Failed to credit user:', err.message);
        return res.status(500).json({ error: 'Failed to credit user' });
      }
    }

    return res.json({ received: true });
  }

  return { createCheckout, webhook };
}

module.exports = { createStripeController, resolvePackage };
