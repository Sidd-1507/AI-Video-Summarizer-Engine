'use strict';
const { asyncWrap } = require('../utils/asyncWrap');

const { Router } = require('express');

function createHighlightsRouter({ authenticate, controller }) {
  const router = Router();

  router.post('/notes/:noteId/highlights', authenticate, asyncWrap(controller.create));
  router.get('/notes/:noteId/highlights',  authenticate, asyncWrap(controller.list));
  router.delete('/highlights/:id',         authenticate, asyncWrap(controller.remove));

  return router;
}

module.exports = { createHighlightsRouter };
