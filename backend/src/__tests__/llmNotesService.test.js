const { createLlmNotesService, LLMResponseValidationError } = require('../services/llmNotesService');

function makeService(completeImpl) {
  return createLlmNotesService({ llmClient: { complete: completeImpl } });
}

const VALID_LLM_RESPONSE = JSON.stringify({
  title: 'Photosynthesis',
  topics: [
    {
      title: 'Light Reactions',
      priority: 3,
      content: 'Occur in the thylakoid membrane...',
      diagrams: ['graph TD; A-->B'],
      revisionPoints: ['Produces ATP and NADPH'],
      questions: [{ type: 'short', text: 'Where do light reactions occur?', answer: 'Thylakoid membrane' }],
    },
  ],
});

describe('llmNotesService.generateNotes', () => {
  test('happy path: parses a well-formed LLM response', async () => {
    const service = makeService(async () => VALID_LLM_RESPONSE);
    const result = await service.generateNotes('some transcript text', { classLevel: '10' });
    expect(result.title).toBe('Photosynthesis');
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].topicId).toBeDefined();
  });

  test('rejects empty/blank transcript input', async () => {
    const service = makeService(async () => VALID_LLM_RESPONSE);
    await expect(service.generateNotes('')).rejects.toThrow();
    await expect(service.generateNotes('   ')).rejects.toThrow();
  });

  test('throws LLMResponseValidationError on non-JSON output', async () => {
    const service = makeService(async () => 'Sure! Here are your notes:\n\n# Notes...');
    await expect(service.generateNotes('text')).rejects.toBeInstanceOf(LLMResponseValidationError);
  });

  test('throws LLMResponseValidationError when required fields are missing', async () => {
    const service = makeService(async () => JSON.stringify({ topics: [] }));
    await expect(service.generateNotes('text')).rejects.toBeInstanceOf(LLMResponseValidationError);
  });

  test('throws LLMResponseValidationError when priority is out of range', async () => {
    const badResponse = JSON.stringify({
      title: 'X',
      topics: [{ title: 'T', priority: 99, content: 'c', questions: [] }],
    });
    const service = makeService(async () => badResponse);
    await expect(service.generateNotes('text')).rejects.toBeInstanceOf(LLMResponseValidationError);
  });

  test('rejects a JSON payload disguised as an array instead of an object (prompt injection attempt)', async () => {
    const service = makeService(async () => JSON.stringify([{ title: 'hacked' }]));
    await expect(service.generateNotes('text')).rejects.toBeInstanceOf(LLMResponseValidationError);
  });

  test('retries once on a transient bad response then succeeds', async () => {
    let calls = 0;
    const service = makeService(async () => {
      calls += 1;
      if (calls === 1) return 'not json';
      return VALID_LLM_RESPONSE;
    });
    const result = await service.generateNotes('text');
    expect(calls).toBe(2);
    expect(result.title).toBe('Photosynthesis');
  });

  test('gives up after exhausting retries', async () => {
    const service = makeService(async () => 'still not json');
    await expect(service.generateNotes('text')).rejects.toBeInstanceOf(LLMResponseValidationError);
  });

  test('chunks very long transcripts and merges + de-dupes overlapping topics', async () => {
    const longTranscript = 'a'.repeat(30_000); // forces multiple chunks at 12k/chunk
    let calls = 0;
    const service = makeService(async () => {
      calls += 1;
      // Every chunk "sees" the same topic — simulates real overlap-induced duplication.
      return VALID_LLM_RESPONSE;
    });
    const result = await service.generateNotes(longTranscript);
    expect(calls).toBeGreaterThan(1);
    expect(result.topics).toHaveLength(1); // de-duped despite multiple chunk calls
  });

  test('constructor throws immediately if no llmClient is given', () => {
    expect(() => createLlmNotesService({})).toThrow();
  });
});
