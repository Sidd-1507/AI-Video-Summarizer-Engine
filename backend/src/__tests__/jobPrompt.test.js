'use strict';

const { createLlmNotesService } = require('../services/llmNotesService');

describe('llm notes prompt options', () => {
  test('includes tone, revision mode, diagrams and charts flags', () => {
    const service = createLlmNotesService({ llmClient: { complete: async () => '{}' } });
    const prompt = service.buildPrompt('material', {
      classLevel: '12',
      board: 'CBSE',
      examType: 'boards',
      tone: 'eli5',
      revisionMode: true,
      includeDiagrams: true,
      includeCharts: true,
    });
    expect(prompt).toMatch(/eli5/);
    expect(prompt).toMatch(/Revision mode: true/);
    expect(prompt).toMatch(/Include mermaid diagrams: true/);
    expect(prompt).toMatch(/Include charts/);
    expect(prompt).toMatch(/CBSE/);
  });
});
