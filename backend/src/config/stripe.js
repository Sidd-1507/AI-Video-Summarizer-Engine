'use strict';

let _stripe = null;

/**
 * Returns the Stripe SDK client. Lazy-initialised so tests that don't
 * touch Stripe don't need STRIPE_SECRET_KEY in the environment.
 */
function getStripe() {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY env var is required');
  }

  _stripe = require('stripe')(key, {
    apiVersion: '2024-06-20',
    appInfo: { name: 'exam-notes-ai', version: '1.0.0' },
  });

  return _stripe;
}

module.exports = { getStripe };
