'use strict';

/**
 * Firebase Storage helpers for uploading images and audio generated
 * by the AI pipeline. All methods return a public download URL.
 *
 * In tests, inject a mock storageHelper — this module is never imported
 * directly by test suites (same DI pattern as the rest of the codebase).
 */

const { getStorageBucket } = require('../config/firebase');
const path = require('path');

/**
 * Uploads a Buffer or base64 string to Firebase Storage.
 * @param {Buffer|string} data - File data (Buffer) or base64-encoded string
 * @param {string} destPath   - Storage path e.g. "notes/abc123/topics/xyz/image.png"
 * @param {string} mimeType   - MIME type e.g. "image/png" | "audio/mpeg"
 * @returns {Promise<string>} - Public download URL
 */
async function uploadFile(data, destPath, mimeType) {
  const bucket = getStorageBucket();
  const file = bucket.file(destPath);

  const buffer = typeof data === 'string' ? Buffer.from(data, 'base64') : data;

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  // Make the file publicly readable and return its URL
  await file.makePublic();
  const [metadata] = await file.getMetadata();
  return `https://storage.googleapis.com/${bucket.name}/${metadata.name}`;
}

/**
 * Deletes all files under a given storage prefix (e.g. when a note is deleted).
 * @param {string} prefix - e.g. "notes/abc123/"
 */
async function deleteFolder(prefix) {
  const bucket = getStorageBucket();
  await bucket.deleteFiles({ prefix });
}

/**
 * Builds the canonical storage path for a topic image.
 */
function topicImagePath(noteId, topicId) {
  return `notes/${noteId}/topics/${topicId}/image.png`;
}

/**
 * Builds the canonical storage path for an audio overview.
 */
function audioOverviewPath(noteId, format) {
  return `notes/${noteId}/audio/${format}.mp3`;
}

module.exports = { uploadFile, deleteFolder, topicImagePath, audioOverviewPath };
