'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createNotesRouter({ authenticate, validatePatchNoteRequest, controller }) {
  const router = Router();

  router.get('/notes',     authenticate, asyncWrap(controller.list));
  router.patch('/notes/:id', authenticate, validatePatchNoteRequest, asyncWrap(controller.update));
  router.get('/notes/:id/transcript', authenticate, asyncWrap(controller.transcript));
  router.get('/notes/:id', authenticate, asyncWrap(controller.detail));
  router.delete('/notes/:id', authenticate, asyncWrap(controller.remove));

  return router;
}

module.exports = { createNotesRouter };
