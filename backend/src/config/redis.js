'use strict';

let _redis = null;
let _queues = {};

/**
 * Returns the IORedis client. Lazy-initialised so tests that don't use the
 * queue don't need REDIS_URL in the environment.
 */
function getRedisClient() {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL env var is required for job queue features');
  }

  // We require ioredis lazily so the module can be safely imported in
  // environments where the queue is not used (e.g. pure unit test runs).
  const Redis = require('ioredis');
  _redis = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  });

  _redis.on('error', (err) => {
    console.error('[Redis] connection error:', err.message);
  });

  return _redis;
}

/**
 * Returns a named BullMQ Queue. Creates it on first call, then caches.
 * Queue names: 'youtube-notes' | 'image-generation' | 'audio-overview' | 'mcq-generation'
 */
function getQueue(name) {
  if (_queues[name]) return _queues[name];

  const { Queue } = require('bullmq');
  _queues[name] = new Queue(name, {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  return _queues[name];
}

async function closeRedis() {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    _queues = {};
  }
}

module.exports = { getRedisClient, getQueue, closeRedis };
