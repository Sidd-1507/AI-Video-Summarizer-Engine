'use strict';

/**
 * Image Service — Gemini Imagen 3
 *
 * Generates an educational diagram/illustration for a note topic using
 * Imagen 3 (`imagen-3.0-generate-002`) via the Google AI REST API.
 * The base64 PNG is uploaded to Firebase Storage and a public URL returned.
 *
 * Rate limit: 10 RPM on free tier — enforce with IMAGEN_CONCURRENCY env var.
 *
 * Inject `imagenProvider` for testability:
 *   real:  createGeminiImagenProvider(apiKey)
 *   tests: { generate: async () => 'base64string' }
 */

const https = require('https');
const { uploadFile, topicImagePath } = require('../utils/storageHelper');

/**
 * Real Imagen 3 provider — calls Google AI REST API.
 * @param {string} apiKey - GEMINI_API_KEY
 */
function createGeminiImagenProvider(apiKey) {
  async function generate(prompt) {
    const body = JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1' },
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Imagen API returned ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            const parsed = JSON.parse(data);
            const b64 = parsed.predictions?.[0]?.bytesBase64Encoded;
            if (!b64) throw new Error('No image data in Imagen response');
            resolve(b64);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  return { generate };
}

/**
 * Builds an educational image prompt for a topic.
 * Designed for Imagen 3 — descriptive, instructional, no text in image.
 */
function buildImagePrompt(topicTitle, topicContent) {
  const summary = topicContent.slice(0, 300).replace(/\n/g, ' ');
  return (
    `A clean, professional educational diagram illustrating "${topicTitle}". ` +
    `Context: ${summary}. ` +
    `Style: minimalist infographic, white background, labeled sections, ` +
    `clear visual hierarchy, suitable for exam preparation. ` +
    `No text overlays, no people, no charts. Vector art style.`
  );
}

/**
 * Generates and stores an image for one topic.
 *
 * @param {object} params
 * @param {object} params.imagenProvider - { generate(prompt): Promise<base64string> }
 * @param {string} params.noteId
 * @param {object} params.topic - { topicId, title, content }
 * @returns {Promise<string>} Public Firebase Storage URL
 */
async function generateTopicImage({ imagenProvider, noteId, topic }) {
  const prompt = buildImagePrompt(topic.title, topic.content);
  const base64Png = await imagenProvider.generate(prompt);
  const path = topicImagePath(noteId, topic.topicId);
  const url = await uploadFile(base64Png, path, 'image/png');
  return url;
}

module.exports = { createGeminiImagenProvider, generateTopicImage, buildImagePrompt };
