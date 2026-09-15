'use strict';

/**
 * Minimal structured logger that wraps console.* with JSON output in
 * production and pretty output in development/test.
 *
 * Replace with winston/pino in v2 if you need log shipping or sampling.
 * The interface intentionally matches winston's { error, warn, info, debug }.
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

function formatMessage(level, message, meta = {}) {
  if (IS_PROD) {
    return JSON.stringify({ level, message, ...meta, ts: new Date().toISOString() });
  }
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  error: (message, meta) => {
    if (!IS_TEST) console.error(formatMessage('error', message, meta));
  },
  warn: (message, meta) => {
    if (!IS_TEST) console.warn(formatMessage('warn', message, meta));
  },
  info: (message, meta) => {
    if (!IS_TEST) console.log(formatMessage('info', message, meta));
  },
  debug: (message, meta) => {
    if (!IS_TEST && process.env.LOG_LEVEL === 'debug') {
      console.log(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;
