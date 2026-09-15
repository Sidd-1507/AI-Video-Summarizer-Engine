module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  projects: [
    {
      // Pure logic tests — no MongoDB, no network, fast
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/youtubeUrl.test.js',
        '<rootDir>/src/__tests__/youtubeTranscriptService.test.js',
        '<rootDir>/src/__tests__/llmNotesService.test.js',
        '<rootDir>/src/__tests__/sm2Service.test.js',
        '<rootDir>/src/__tests__/mcqService.test.js',
        '<rootDir>/src/__tests__/jobPrompt.test.js',
        '<rootDir>/src/__tests__/localAuth.test.js',
        '<rootDir>/src/__tests__/transcriptNotes.test.js',
      ],
    },
    {
      // DB-backed tests — require mongodb-memory-server binary download (network)
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/creditService.test.js',
        '<rootDir>/src/__tests__/youtubeNotesOrchestrator.test.js',
        '<rootDir>/src/__tests__/youtubeNotes.http.test.js',
        '<rootDir>/src/__tests__/phase2.http.test.js',
        '<rootDir>/src/__tests__/phase3.http.test.js',
        '<rootDir>/src/__tests__/notesApi.http.test.js',
        '<rootDir>/src/__tests__/auth.http.test.js',
      ],
    },
    {
      // Phase 4 wiring tests — verify provider interfaces + graceful failures
      // Some tests make real external network calls (with fake keys → expect rejection)
      displayName: 'phase4',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/__tests__/phase4.wiring.test.js',
      ],
    },
  ],
};
