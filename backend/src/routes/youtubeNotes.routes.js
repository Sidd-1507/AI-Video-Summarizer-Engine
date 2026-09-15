'use strict';
const { asyncWrap } = require('../utils/asyncWrap');

const { Router } = require('express');

/**
 * Factory that returns the YouTube Notes router.
 * All dependencies are injected so the router is fully testable without
 * real Firebase, MongoDB, or rate-limit stores.
 *
 * @param {object} deps
 * @param {Function} deps.authenticate       - auth middleware
 * @param {Function} deps.rateLimiter        - rate-limit middleware
 * @param {Function} deps.validateYoutubeNotesRequest - validation middleware
 * @param {object}   deps.controller         - { create } from youtubeNotesController
 */
function createYoutubeNotesRouter({ authenticate, rateLimiter, validateYoutubeNotesRequest, controller }) {
  const router = Router();

  /**
   * POST /api/youtube-notes
   * Returns 201 { jobId, note } when jobs run synchronously (tests / no Redis).
   * Returns 202 { jobId, note } when a worker/queue is used.
   */
  router.post(
    '/youtube-notes',
    authenticate,
    rateLimiter,
    validateYoutubeNotesRequest,
    asyncWrap(controller.create)
  );

  return router;
}

module.exports = { createYoutubeNotesRouter };
