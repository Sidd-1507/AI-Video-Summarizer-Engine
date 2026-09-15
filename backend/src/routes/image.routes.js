'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createImageRouter({ authenticate, controller }) {
  const router = Router();
  router.post('/notes/:noteId/topics/:topicId/image', authenticate, asyncWrap(controller.generate));
  router.get('/notes/:noteId/topics/:topicId/image',  authenticate, asyncWrap(controller.status));
  return router;
}

module.exports = { createImageRouter };
