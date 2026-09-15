'use strict';
const { asyncWrap } = require('../utils/asyncWrap');

const { Router } = require('express');

function createStickyNotesRouter({ authenticate, controller }) {
  const router = Router();

  // Scoped to a note
  router.post('/notes/:noteId/sticky-notes', authenticate, asyncWrap(controller.create));
  router.get('/notes/:noteId/sticky-notes',  authenticate, asyncWrap(controller.list));

  // Standalone ops by sticky note id
  router.patch('/sticky-notes/:id',  authenticate, asyncWrap(controller.update));
  router.delete('/sticky-notes/:id', authenticate, asyncWrap(controller.remove));

  return router;
}

module.exports = { createStickyNotesRouter };
