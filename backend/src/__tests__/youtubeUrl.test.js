const { extractVideoId, InvalidYoutubeUrlError } = require('../utils/youtubeUrl');

describe('extractVideoId', () => {
  test('parses a watch URL whose video id starts with a hyphen', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=-d9cbpylDCk')).toBe('-d9cbpylDCk');
  });

  test('parses a youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('parses an embed URL', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('parses a shorts URL', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('parses a watch URL with extra tracking params', () => {
    expect(
      extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123')
    ).toBe('dQw4w9WgXcQ');
  });

  // --- Extreme / adversarial cases ---

  test('rejects a non-youtube host impersonating youtube in the path', () => {
    expect(() => extractVideoId('https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ')).toThrow(
      InvalidYoutubeUrlError
    );
  });

  test('rejects a host that merely contains "youtube.com" as a substring', () => {
    expect(() => extractVideoId('https://youtube.com.evil.net/watch?v=dQw4w9WgXcQ')).toThrow(
      InvalidYoutubeUrlError
    );
  });

  test('rejects javascript: URLs', () => {
    expect(() => extractVideoId('javascript:alert(1)')).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects file: URLs', () => {
    expect(() => extractVideoId('file:///etc/passwd')).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects an internal/SSRF-style URL even if hostname is spoofable via userinfo', () => {
    expect(() =>
      extractVideoId('https://www.youtube.com@169.254.169.254/watch?v=dQw4w9WgXcQ')
    ).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects a video id that is too short', () => {
    expect(() => extractVideoId('https://youtu.be/abc')).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects a video id with path traversal characters', () => {
    expect(() => extractVideoId('https://youtu.be/../../etc/passwd')).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects empty string', () => {
    expect(() => extractVideoId('')).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects null/undefined gracefully', () => {
    expect(() => extractVideoId(undefined)).toThrow(InvalidYoutubeUrlError);
    expect(() => extractVideoId(null)).toThrow(InvalidYoutubeUrlError);
  });

  test('rejects a URL missing the v= param on /watch', () => {
    expect(() => extractVideoId('https://www.youtube.com/watch?list=PL123')).toThrow(
      InvalidYoutubeUrlError
    );
  });

  test('handles an extremely long garbage string without hanging or crashing the process', () => {
    const huge = 'https://www.youtube.com/watch?v=' + 'a'.repeat(100_000);
    expect(() => extractVideoId(huge)).toThrow(InvalidYoutubeUrlError);
  });
});
