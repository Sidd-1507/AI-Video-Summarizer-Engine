'use strict';

const { Router } = require('express');
const { asyncWrap } = require('../utils/asyncWrap');

function createAuthRouter({ authenticate, controller }) {
  const router = Router();
  router.post('/auth/register', asyncWrap(controller.register));
  router.post('/auth/login', asyncWrap(controller.login));
  router.get('/auth/me', authenticate, asyncWrap(controller.me));
  return router;
}

module.exports = { createAuthRouter };
