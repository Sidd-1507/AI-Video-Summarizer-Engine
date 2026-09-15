'use strict';

/**
 * server.js — Production HTTP entry point
 * Binds 0.0.0.0:$PORT (Render / any container).
 */

const { createRuntime } = require('./runtime');
const { createApp }     = require('./app');

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const deps = await createRuntime();
  const app = createApp(deps);

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n[Server] Exam Notes AI API listening on ${HOST}:${PORT}`);
    console.log(`[Server] Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] LLM Provider: ${process.env.LLM_PROVIDER || 'gemini'}`);
    console.log(`[Server] Jobs        : ${process.env.REDIS_URL ? 'BullMQ' : 'in-process async'}`);
    console.log(`[Server] MongoDB     : connected`);
    console.log(`[Server] Firebase    : ${deps.firebaseAdmin ? 'initialised' : 'off (email/password auth)'}\n`);
  });

  function shutdown(signal) {
    console.log(`\n[Server] ${signal} — shutting down gracefully`);
    server.close(() => {
      console.log('[Server] HTTP closed. Goodbye.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});
