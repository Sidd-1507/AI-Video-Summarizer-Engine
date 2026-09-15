'use strict';
const { asyncWrap } = require('../utils/asyncWrap');

const { Router } = require('express');

function createCreditsRouter({ authenticate, controller }) {
  const router = Router();

  router.get('/credits/balance', authenticate, asyncWrap(controller.balance));
  router.get('/credits/history', authenticate, asyncWrap(controller.history));
  router.get('/credits/packages', authenticate, asyncWrap(controller.packages));

  return router;
}

module.exports = { createCreditsRouter };
