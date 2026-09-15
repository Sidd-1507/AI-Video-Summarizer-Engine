'use strict';
const { asyncWrap } = require('../utils/asyncWrap');

const { Router } = require('express');

function createFlashcardsRouter({ authenticate, controller }) {
  const router = Router();

  // Generate cards from note topics (idempotent)
  router.post('/notes/:noteId/flashcards/generate', authenticate, asyncWrap(controller.generate));
  // List all cards for a note (?due=true filters to today's queue)
  router.get('/notes/:noteId/flashcards',           authenticate, asyncWrap(controller.list));

  router.get('/flashcards/due', authenticate, asyncWrap(controller.due));
  router.post('/flashcards/:id/review', authenticate, asyncWrap(controller.review));
  router.delete('/flashcards/:id',      authenticate, asyncWrap(controller.remove));

  return router;
}

module.exports = { createFlashcardsRouter };
