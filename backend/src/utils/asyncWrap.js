'use strict';

/**
 * asyncWrap — catches rejected promises from async route handlers
 * and forwards the error to Express's error middleware via next(err).
 * Without this, unhandled promise rejections crash the server in Node <20.
 *
 * Usage:
 *   router.get('/path', asyncWrap(async (req, res) => { ... }))
 */
function asyncWrap(fn) {
  return function wrappedAsyncHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncWrap };
