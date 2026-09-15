'use strict';

/**
 * BullMQ worker for long-running notes generation.
 * Requires REDIS_URL. The API process enqueues; this process runs the jobs.
 *
 *   npm run start:worker
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const { createRuntime } = require('../runtime');
const { processJob } = require('../services/jobService');
const { getRedisClient } = require('../config/redis');

const QUEUE_NAMES = ['youtube-notes', 'topic-notes'];

async function main() {
  if (!process.env.REDIS_URL) {
    console.error('[Worker] REDIS_URL is required. The API will run jobs in-process without a worker.');
    process.exit(1);
  }

  const deps = await createRuntime();
  const connection = getRedisClient();

  const workers = QUEUE_NAMES.map((name) => {
    const worker = new Worker(
      name,
      async (job) => {
        console.log(`[Worker] ${name} ${job.id} → ${job.data.jobId}`);
        await processJob(deps, job.data.jobId);
      },
      { connection, concurrency: 2 }
    );

    worker.on('failed', (job, err) => {
      console.error(`[Worker] ${name} failed`, job?.id, err.message);
    });

    return worker;
  });

  console.log(`[Worker] listening on ${QUEUE_NAMES.join(', ')}`);

  async function shutdown(signal) {
    console.log(`[Worker] ${signal} — closing`);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Worker] Fatal:', err.message);
  process.exit(1);
});
