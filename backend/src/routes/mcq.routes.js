'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createMcqRouter({ authenticate, controller }) {
  const router = Router();
  router.post('/notes/:noteId/topics/:topicId/mcqs',        authenticate, asyncWrap(controller.generate));
  router.get('/notes/:noteId/topics/:topicId/mcqs',         authenticate, asyncWrap(controller.get));
  router.post('/notes/:noteId/topics/:topicId/mcqs/submit', authenticate, asyncWrap(controller.submit));
  return router;
}

module.exports = { createMcqRouter };
