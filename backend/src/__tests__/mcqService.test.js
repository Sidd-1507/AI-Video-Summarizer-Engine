'use strict';

const { generateMcqs, parseMcqResponse, buildMcqPrompt, McqGenerationError } = require('../services/mcqService');

// ─── Fixtures ───────────────────────────────────────────────────────────────
const sampleTopic = {
  topicId:  'tp1',
  title:    'Photosynthesis',
  content:  'Photosynthesis is the process by which plants convert sunlight into glucose using CO2 and water.',
  revisionPoints: ['Chlorophyll absorbs light', 'Produces oxygen as byproduct', 'Occurs in chloroplasts'],
};

function makeMcqArray(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    question:      `Question ${i + 1}?`,
    options:       [
      { label: 'A', text: 'Option A' },
      { label: 'B', text: 'Option B' },
      { label: 'C', text: 'Option C' },
      { label: 'D', text: 'Option D' },
    ],
    correctAnswer: 'A',
    explanation:   `Explanation for Q${i + 1}`,
    difficulty:    ['easy', 'medium', 'hard'][i % 3],
  }));
}

// ─── parseMcqResponse tests ──────────────────────────────────────────────────
describe('parseMcqResponse', () => {
  test('parses clean JSON array', () => {
    const input = JSON.stringify(makeMcqArray(3));
    const result = parseMcqResponse(input);
    expect(result).toHaveLength(3);
    expect(result[0].question).toBe('Question 1?');
    expect(result[0].correctAnswer).toBe('A');
    expect(result[0].options).toHaveLength(4);
  });

  test('strips markdown code fences before parsing', () => {
    const input = '```json\n' + JSON.stringify(makeMcqArray(2)) + '\n```';
    const result = parseMcqResponse(input);
    expect(result).toHaveLength(2);
  });

  test('extracts JSON array even with surrounding text', () => {
    const input = 'Here are your MCQs:\n' + JSON.stringify(makeMcqArray(1)) + '\nHope that helps!';
    const result = parseMcqResponse(input);
    expect(result).toHaveLength(1);
  });

  test('throws McqGenerationError if no JSON array found', () => {
    expect(() => parseMcqResponse('No JSON here at all')).toThrow(McqGenerationError);
  });

  test('throws on invalid JSON', () => {
    expect(() => parseMcqResponse('[{invalid json')).toThrow(McqGenerationError);
  });

  test('throws if correctAnswer is not A-D', () => {
    const bad = makeMcqArray(1);
    bad[0].correctAnswer = 'E';
    expect(() => parseMcqResponse(JSON.stringify(bad))).toThrow(McqGenerationError);
  });

  test('throws if options array does not have exactly 4 items', () => {
    const bad = makeMcqArray(1);
    bad[0].options = [{ label: 'A', text: 'only one' }];
    expect(() => parseMcqResponse(JSON.stringify(bad))).toThrow(McqGenerationError);
  });

  test('clamps question and explanation to max length', () => {
    const big = makeMcqArray(1);
    big[0].question = 'Q'.repeat(2000);
    big[0].explanation = 'E'.repeat(2000);
    const result = parseMcqResponse(JSON.stringify(big));
    expect(result[0].question.length).toBeLessThanOrEqual(1000);
    expect(result[0].explanation.length).toBeLessThanOrEqual(1000);
  });

  test('defaults unknown difficulty to "medium"', () => {
    const bad = makeMcqArray(1);
    bad[0].difficulty = 'super-hard';
    const result = parseMcqResponse(JSON.stringify(bad));
    expect(result[0].difficulty).toBe('medium');
  });
});

// ─── buildMcqPrompt tests ────────────────────────────────────────────────────
describe('buildMcqPrompt', () => {
  test('includes topic title and content in prompt', () => {
    const prompt = buildMcqPrompt(sampleTopic, 5);
    expect(prompt).toContain('Photosynthesis');
    expect(prompt).toContain('5');
    expect(prompt).toContain('JSON array');
  });

  test('truncates very long content to 1500 chars', () => {
    const longTopic = { ...sampleTopic, content: 'X'.repeat(5000), revisionPoints: [] };
    const prompt = buildMcqPrompt(longTopic, 3);
    // Content in prompt should be max 1500
    expect(prompt).toContain('X'.repeat(1500));
    expect(prompt).not.toContain('X'.repeat(1501));
  });
});

// ─── generateMcqs tests ──────────────────────────────────────────────────────
describe('generateMcqs', () => {
  test('calls llmClient.complete and returns parsed MCQs', async () => {
    const mockLlm = {
      complete: jest.fn().mockResolvedValue(JSON.stringify(makeMcqArray(5))),
    };

    const result = await generateMcqs({ llmClient: mockLlm, topic: sampleTopic, count: 5 });

    expect(mockLlm.complete).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(5);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('correctAnswer');
    expect(result[0]).toHaveProperty('options');
    expect(result[0].options).toHaveLength(4);
  });

  test('propagates McqGenerationError when LLM returns garbage', async () => {
    const mockLlm = { complete: jest.fn().mockResolvedValue('not json at all') };
    await expect(generateMcqs({ llmClient: mockLlm, topic: sampleTopic }))
      .rejects.toThrow(McqGenerationError);
  });

  test('propagates underlying LLM errors', async () => {
    const mockLlm = { complete: jest.fn().mockRejectedValue(new Error('API quota exceeded')) };
    await expect(generateMcqs({ llmClient: mockLlm, topic: sampleTopic }))
      .rejects.toThrow('API quota exceeded');
  });
});

// ─── audioService SSML tests ─────────────────────────────────────────────────
describe('audioService — SSML builders', () => {
  const { buildDeepDiveSsml, buildBriefSsml, escapeXml } = require('../services/audioService');

  const topics = [
    { title: 'Topic A', priority: 2, content: 'Content for A', revisionPoints: ['Point 1', 'Point 2'] },
    { title: 'Topic B', priority: 1, content: 'Content for B', revisionPoints: [] },
  ];

  test('buildDeepDiveSsml returns valid SSML with <speak> root', () => {
    const ssml = buildDeepDiveSsml('My Notes', topics);
    expect(ssml).toMatch(/<speak>/);
    expect(ssml).toMatch(/<\/speak>/);
    expect(ssml).toContain('My Notes');
    expect(ssml).toContain('Topic A');
    expect(ssml).toContain('Topic B');
  });

  test('buildBriefSsml is shorter than deepDive SSML', () => {
    const deep  = buildDeepDiveSsml('My Notes', topics);
    const brief = buildBriefSsml('My Notes', topics);
    expect(brief.length).toBeLessThan(deep.length);
  });

  test('escapeXml handles all special XML characters', () => {
    expect(escapeXml('A & B < C > D " E \' F')).toBe(
      'A &amp; B &lt; C &gt; D &quot; E &apos; F'
    );
  });

  test('escapeXml safely handles topic titles with special chars', () => {
    const topics2 = [{ title: 'Energy & Matter', priority: 1, content: 'E=mc<sup>2</sup>', revisionPoints: [] }];
    const ssml = buildDeepDiveSsml('Science', topics2);
    expect(ssml).not.toContain('E=mc<sup>'); // should be escaped
    expect(ssml).toContain('Energy &amp; Matter');
  });
});

// ─── imageService prompt builder ─────────────────────────────────────────────
describe('imageService — buildImagePrompt', () => {
  const { buildImagePrompt } = require('../services/imageService');

  test('includes topic title in prompt', () => {
    const prompt = buildImagePrompt('Osmosis', 'Water moves across membranes');
    expect(prompt).toContain('Osmosis');
    expect(prompt).toContain('educational diagram');
  });

  test('truncates long content to 300 chars', () => {
    const longContent = 'X'.repeat(1000);
    const prompt = buildImagePrompt('Title', longContent);
    // should contain max 300 X's
    expect(prompt).toContain('X'.repeat(300));
    expect(prompt).not.toContain('X'.repeat(301));
  });

  test('prompt includes style keywords for Imagen 3', () => {
    const prompt = buildImagePrompt('Mitosis', 'Cell division process');
    expect(prompt).toContain('Vector art style');
    expect(prompt).toContain('white background');
  });
});
