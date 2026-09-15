'use strict';

/**
 * Audio Overview Service — Google Cloud Text-to-Speech
 *
 * Generates a podcast-style audio overview of a note using two voices:
 *   Host A (en-US-Journey-F) — asks questions, drives narrative
 *   Host B (en-US-Journey-D) — deep dives, explains concepts
 *
 * Formats:
 *   deepDive — full multi-topic exploration (~5-8 min)
 *   brief    — 2-min summary of key points
 *
 * Uses SSML for pauses, emphasis, and speaker transitions.
 * Output: MP3 uploaded to Firebase Storage → public URL.
 *
 * Inject `ttsProvider` for testability:
 *   real:  createGoogleTtsProvider(apiKey)
 *   tests: { synthesize: async () => Buffer.from('fake-mp3') }
 */

const https = require('https');
const { uploadFile, audioOverviewPath } = require('../utils/storageHelper');

/**
 * Real Google TTS provider via REST API.
 * @param {string} apiKey - Google Cloud API key with TTS enabled
 */
function createGoogleTtsProvider(apiKey) {
  /**
   * @param {string} ssml - SSML markup
   * @param {string} voiceName - e.g. 'en-US-Journey-F'
   * @returns {Promise<Buffer>} MP3 audio buffer
   */
  async function synthesize(ssml, voiceName = 'en-US-Journey-F') {
    const body = JSON.stringify({
      input: { ssml },
      voice: { languageCode: 'en-US', name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.05,
        pitch: 0,
      },
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'texttospeech.googleapis.com',
        path: `/v1/text:synthesize?key=${apiKey}`,
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
            return reject(new Error(`TTS API returned ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            const parsed = JSON.parse(data);
            const b64 = parsed.audioContent;
            if (!b64) throw new Error('No audioContent in TTS response');
            resolve(Buffer.from(b64, 'base64'));
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

  return { synthesize };
}

/**
 * Builds SSML for the Deep Dive format (dual-voice podcast).
 * Alternates between Host A (questions) and Host B (explanations).
 */
function buildDeepDiveSsml(noteTitle, topics) {
  const lines = [
    `<speak>`,
    `<voice name="en-US-Journey-F">`,
    `Welcome to your Deep Dive on <emphasis level="strong">${escapeXml(noteTitle)}</emphasis>. `,
    `I'm your host, and we're going to break this down topic by topic. Let's dive in.`,
    `<break time="800ms"/>`,
    `</voice>`,
  ];

  topics.forEach((topic, i) => {
    const points = topic.revisionPoints?.slice(0, 3) || [];
    const pointsText = points.map(p => escapeXml(p)).join('. ');

    lines.push(`<voice name="en-US-Journey-F">`);
    lines.push(`Topic ${i + 1}: <emphasis level="moderate">${escapeXml(topic.title)}</emphasis>. `);
    lines.push(`This is a priority ${topic.priority} topic. What's the key insight here?`);
    lines.push(`<break time="500ms"/></voice>`);

    lines.push(`<voice name="en-US-Journey-D">`);
    lines.push(`Great question. ${escapeXml(topic.content.slice(0, 200))}. `);
    if (pointsText) {
      lines.push(`The revision points to remember are: ${pointsText}.`);
    }
    lines.push(`<break time="600ms"/></voice>`);
  });

  lines.push(`<voice name="en-US-Journey-F">`);
  lines.push(`That covers all ${topics.length} topics. Good luck with your exam!`);
  lines.push(`<break time="400ms"/></voice>`);
  lines.push(`</speak>`);

  return lines.join('\n');
}

/**
 * Builds SSML for the Brief format (single voice, 2-min summary).
 */
function buildBriefSsml(noteTitle, topics) {
  const lines = [`<speak>`];
  lines.push(`<voice name="en-US-Journey-F">`);
  lines.push(`Quick revision for <emphasis level="strong">${escapeXml(noteTitle)}</emphasis>. `);
  lines.push(`<break time="400ms"/>`);

  topics.forEach((topic, i) => {
    const point = topic.revisionPoints?.[0] || topic.content.slice(0, 100);
    lines.push(`${i + 1}. ${escapeXml(topic.title)}: ${escapeXml(point)}. <break time="300ms"/>`);
  });

  lines.push(`That's your brief. Review the full notes for more detail.`);
  lines.push(`</voice></speak>`);
  return lines.join('\n');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates and stores both Deep Dive and Brief audio overviews.
 *
 * @param {object} params
 * @param {object} params.ttsProvider - { synthesize(ssml, voiceName): Promise<Buffer> }
 * @param {string} params.noteId
 * @param {string} params.noteTitle
 * @param {Array}  params.topics
 * @param {string} params.format - 'deepDive' | 'brief' | 'all'
 * @returns {Promise<{ deepDive?: string, brief?: string }>} Public URLs
 */
async function generateAudioOverview({ ttsProvider, noteId, noteTitle, topics, format = 'all' }) {
  const urls = {};

  if (format === 'deepDive' || format === 'all') {
    const ssml = buildDeepDiveSsml(noteTitle, topics);
    // Deep Dive uses Host A voice (Journey-F leads), TTS renders inline voice tags
    const mp3Buffer = await ttsProvider.synthesize(ssml, 'en-US-Journey-F');
    urls.deepDive = await uploadFile(mp3Buffer, audioOverviewPath(noteId, 'deepDive'), 'audio/mpeg');
  }

  if (format === 'brief' || format === 'all') {
    const ssml = buildBriefSsml(noteTitle, topics);
    const mp3Buffer = await ttsProvider.synthesize(ssml, 'en-US-Journey-F');
    urls.brief = await uploadFile(mp3Buffer, audioOverviewPath(noteId, 'brief'), 'audio/mpeg');
  }

  return urls;
}

module.exports = {
  createGoogleTtsProvider,
  generateAudioOverview,
  buildDeepDiveSsml,
  buildBriefSsml,
  escapeXml,
};
