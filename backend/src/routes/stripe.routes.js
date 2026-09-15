'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createStripeRouter({ authenticate, controller }) {
  const router = Router();
  router.post('/stripe/checkout', authenticate, asyncWrap(controller.createCheckout));
  return router;
}

module.exports = { createStripeRouter };
