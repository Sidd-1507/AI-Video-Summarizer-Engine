'use strict';
const { asyncWrap } = require('../utils/asyncWrap');
const { Router } = require('express');

function createJobsRouter({ authenticate, controller }) {
  const router = Router();
  router.get('/jobs/:id', authenticate, asyncWrap(controller.get));
  return router;
}

module.exports = { createJobsRouter };
