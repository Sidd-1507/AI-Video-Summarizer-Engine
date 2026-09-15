const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts and validates an 11-char YouTube video ID from a URL.
 * Throws on anything that isn't a well-formed, allow-listed YouTube URL.
 * This is a security boundary: it prevents SSRF-style abuse where a
 * crafted "youtube url" is actually a pointer at an internal service,
 * and it prevents injecting arbitrary strings into downstream calls.
 */
function extractVideoId(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new InvalidYoutubeUrlError('URL is required');
  }

  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new InvalidYoutubeUrlError('Not a valid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new InvalidYoutubeUrlError('Only http/https URLs are allowed');
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new InvalidYoutubeUrlError('URL must be a youtube.com or youtu.be link');
  }

  let videoId = null;

  if (url.hostname === 'youtu.be') {
    videoId = url.pathname.slice(1).split('/')[0];
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/embed/')) {
    videoId = url.pathname.split('/embed/')[1]?.split('/')[0];
  } else if (url.pathname.startsWith('/shorts/')) {
    videoId = url.pathname.split('/shorts/')[1]?.split('/')[0];
  }

  if (!videoId || !VIDEO_ID_RE.test(videoId)) {
    throw new InvalidYoutubeUrlError('Could not find a valid video ID in the URL');
  }

  return videoId;
}

class InvalidYoutubeUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidYoutubeUrlError';
    this.statusCode = 400;
  }
}

module.exports = { extractVideoId, InvalidYoutubeUrlError };
