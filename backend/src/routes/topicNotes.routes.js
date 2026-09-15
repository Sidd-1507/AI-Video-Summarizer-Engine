'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createTopicNotesRouter({ authenticate, rateLimiter, validateTopicNotesRequest, controller }) {
  const router = Router();

  router.post(
    '/topic-notes',
    authenticate,
    rateLimiter,
    validateTopicNotesRequest,
    asyncWrap(controller.create)
  );

  return router;
}

module.exports = { createTopicNotesRouter };
