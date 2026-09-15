'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createAudioRouter({ authenticate, controller }) {
  const router = Router();
  router.post('/notes/:noteId/audio', authenticate, asyncWrap(controller.generate));
  router.get('/notes/:noteId/audio',  authenticate, asyncWrap(controller.status));
  return router;
}

module.exports = { createAudioRouter };
