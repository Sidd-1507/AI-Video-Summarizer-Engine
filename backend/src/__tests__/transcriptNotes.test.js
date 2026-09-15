'use strict';

const { notesFromTranscript, isUnconfiguredLlmError } = require('../services/transcriptNotes');

describe('notesFromTranscript', () => {
  test('turns caption text into titled topics', () => {
    const markdown = '# Transcript for video abc\n\nFirst idea. Second idea that is longer. Third point.';
    const notes = notesFromTranscript(markdown, {}, { videoTitle: 'Class lecture' });
    expect(notes.title).toBe('Class lecture');
    expect(notes.topics.length).toBeGreaterThan(0);
    expect(notes.topics[0].content).toContain('First idea');
    expect(notes.topics[0].revisionPoints.length).toBeGreaterThan(0);
  });
});

describe('isUnconfiguredLlmError', () => {
  test('detects a missing Gemini key', () => {
    expect(isUnconfiguredLlmError(new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini'))).toBe(true);
    expect(isUnconfiguredLlmError(new Error('Transcript exceeds the maximum supported length'))).toBe(false);
  });
});
