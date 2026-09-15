const { extractVideoId } = require('../utils/youtubeUrl');

class NoCaptionsError extends Error {
  constructor(videoId) {
    super(`No captions available for video ${videoId}`);
    this.name = 'NoCaptionsError';
    this.statusCode = 422;
  }
}

class TranscriptFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscriptFetchError';
    this.statusCode = 502;
  }
}

const MAX_TRANSCRIPT_CHARS = 200_000; // guardrail against pathological/huge caption dumps

/**
 * captionProvider is injected so this service has zero real network calls
 * in unit tests. In production, wire it to a real caption-fetch client
 * (e.g. a wrapper around the youtube-transcript package or the timedtext API).
 * Contract: captionProvider.fetch(videoId) => Promise<Array<{ start: number, text: string }>>
 */
function createYoutubeTranscriptService({ captionProvider }) {
  if (!captionProvider || typeof captionProvider.fetch !== 'function') {
    throw new Error('captionProvider with a fetch(videoId) method is required');
  }

  async function fetchTranscript(youtubeUrl) {
    const videoId = extractVideoId(youtubeUrl);

    let rawSegments;
    try {
      rawSegments = await captionProvider.fetch(videoId);
    } catch (err) {
      if (err && err.name === 'NoCaptionsError') throw err;
      throw new TranscriptFetchError(`Failed to fetch captions: ${err.message}`);
    }

    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      throw new NoCaptionsError(videoId);
    }

    const segments = sanitizeSegments(rawSegments);
    const markdown = toMarkdown(videoId, segments);

    if (markdown.length > MAX_TRANSCRIPT_CHARS) {
      throw new TranscriptFetchError('Transcript exceeds the maximum supported length');
    }

    return { videoId, segments, markdown };
  }

  return { fetchTranscript };
}

function sanitizeSegments(rawSegments) {
  return rawSegments
    .filter((s) => s && typeof s.text === 'string' && typeof s.start === 'number')
    .map((s) => ({
      start: Math.max(0, s.start),
      // Strip control characters and collapse whitespace; captions are
      // untrusted third-party text and get persisted + later sent to an LLM.
      text: s.text.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((s) => s.text.length > 0);
}

function toMarkdown(videoId, segments) {
  const header = `# Transcript for video ${videoId}\n\n`;
  const body = segments.map((s) => s.text).join(' ');
  return header + body;
}

module.exports = { createYoutubeTranscriptService, NoCaptionsError, TranscriptFetchError };
