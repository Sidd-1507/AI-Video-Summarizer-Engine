'use strict';

const mongoose = require('mongoose');

/**
 * Connects to MongoDB once. Safe to call multiple times — subsequent calls
 * are no-ops if already connected.
 *
 * Retry logic: waits up to 30 s on initial connect (serverSelectionTimeoutMS).
 * In production, Atlas handles replica failover; Mongoose auto-reconnects.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI env var is required');
  }

  if (mongoose.connection.readyState === 1) {
    return; // already connected
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });

  console.log('[DB] MongoDB connected:', mongoose.connection.host);

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected — Mongoose will auto-reconnect');
  });
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[DB] MongoDB disconnected cleanly');
  }
}

module.exports = { connectDB, disconnectDB };
