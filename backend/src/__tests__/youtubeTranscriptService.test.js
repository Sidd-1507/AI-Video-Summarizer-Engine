const {
  createYoutubeTranscriptService,
  NoCaptionsError,
  TranscriptFetchError,
} = require('../services/youtubeTranscriptService');

function makeService(fetchImpl) {
  return createYoutubeTranscriptService({ captionProvider: { fetch: fetchImpl } });
}

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('youtubeTranscriptService.fetchTranscript', () => {
  test('happy path: builds markdown from segments', async () => {
    const service = makeService(async () => [
      { start: 0, text: 'Hello everyone' },
      { start: 2, text: 'welcome to the lecture' },
    ]);

    const result = await service.fetchTranscript(VALID_URL);

    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.segments).toHaveLength(2);
    expect(result.markdown).toContain('Hello everyone welcome to the lecture');
    expect(result.markdown.startsWith('# Transcript for video dQw4w9WgXcQ')).toBe(true);
  });

  test('throws NoCaptionsError when the provider returns an empty array', async () => {
    const service = makeService(async () => []);
    await expect(service.fetchTranscript(VALID_URL)).rejects.toBeInstanceOf(NoCaptionsError);
  });

  test('throws NoCaptionsError when the provider returns null', async () => {
    const service = makeService(async () => null);
    await expect(service.fetchTranscript(VALID_URL)).rejects.toBeInstanceOf(NoCaptionsError);
  });

  test('wraps provider network failures as TranscriptFetchError', async () => {
    const service = makeService(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(service.fetchTranscript(VALID_URL)).rejects.toBeInstanceOf(TranscriptFetchError);
  });

  test('propagates the invalid-URL error before ever calling the provider', async () => {
    const fetchSpy = jest.fn();
    const service = makeService(fetchSpy);
    await expect(service.fetchTranscript('https://evil.com/not-youtube')).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('strips control characters and script-like content is kept as inert text, not executed', async () => {
    const service = makeService(async () => [
      { start: 0, text: '<script>alert(1)</script> some \u0007 caption text' },
    ]);
    const result = await service.fetchTranscript(VALID_URL);
    // Content is preserved as plain text (sanitization for rendering happens
    // at the frontend layer per TECH_STACK.md) but control chars are gone
    // and no exception is thrown while processing it.
    expect(result.markdown).not.toMatch(/\u0007/);
    expect(result.markdown).toContain('<script>alert(1)</script>');
  });

  test('filters out malformed segments (missing text/start) without crashing', async () => {
    const service = makeService(async () => [
      { start: 0, text: 'good segment' },
      { text: 'missing start' },
      { start: 5 },
      null,
      { start: 'not-a-number', text: 'bad type' },
    ]);
    const result = await service.fetchTranscript(VALID_URL);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('good segment');
  });

  test('rejects a pathologically large transcript rather than persisting it unbounded', async () => {
    const hugeSegments = Array.from({ length: 50_000 }, (_, i) => ({
      start: i,
      text: 'word '.repeat(20),
    }));
    const service = makeService(async () => hugeSegments);
    await expect(service.fetchTranscript(VALID_URL)).rejects.toBeInstanceOf(TranscriptFetchError);
  });

  test('constructor throws immediately if no captionProvider is given', () => {
    expect(() => createYoutubeTranscriptService({})).toThrow();
  });
});
