'use strict';

const { v4: uuidv4 } = require('uuid');

function splitChunks(text, size, maxChunks) {
  const chunks = [];
  let remaining = String(text || '').trim();
  while (remaining.length && chunks.length < maxChunks) {
    if (remaining.length <= size) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(' ', size);
    if (cut < size * 0.4) cut = size;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining && chunks.length) {
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${remaining}`.trim().slice(0, size * 2);
  }
  return chunks.filter(Boolean);
}

function sentences(text) {
  return String(text)
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/**
 * Structured study notes from captions when Gemini/OpenAI is not configured.
 * Same shape as llmNotesService so the viewer, flashcards, and quiz tabs still render.
 */
function notesFromTranscript(markdown, options = {}, extras = {}) {
  const body = String(markdown || '').replace(/^# Transcript[^\n]*\n+/i, '').trim();
  const title = extras.videoTitle || body.split(/\s+/).slice(0, 10).join(' ') || 'YouTube notes';
  const chunks = splitChunks(body, 1600, 12);
  const sourceChunks = chunks.length ? chunks : [body || 'No captions were available to turn into notes.'];

  const topics = sourceChunks.map((content, i) => {
    const bits = sentences(content);
    const heading = bits[0] || content.slice(0, 80);
    return {
      topicId: uuidv4(),
      title: heading.slice(0, 90),
      priority: i < 3 ? 3 : i < 7 ? 2 : 1,
      content,
      diagrams: [],
      charts: [],
      revisionPoints: (bits.length ? bits : [content]).slice(0, 5),
      questions: [
        {
          type: 'short',
          text: `What is the main point of “${heading.slice(0, 60)}”?`,
          answer: bits[1] || heading,
        },
      ],
    };
  });

  return { title, topics };
}

function isUnconfiguredLlmError(err) {
  const msg = String(err && err.message ? err.message : err || '');
  return /GEMINI_API_KEY|OPENAI_API_KEY|API key|not configured/i.test(msg);
}

async function fetchYoutubeTitle(youtubeUrl) {
  if (process.env.NODE_ENV === 'test' || !youtubeUrl) return null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`,
      { headers: { 'User-Agent': 'Notewise/1.0' }, signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null;
  } catch {
    return null;
  }
}

module.exports = { notesFromTranscript, isUnconfiguredLlmError, fetchYoutubeTitle };
