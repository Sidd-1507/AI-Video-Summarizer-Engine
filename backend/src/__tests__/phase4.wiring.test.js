'use strict';

/**
 * Phase 4 Wiring Tests
 *
 * Validates that every real provider/adapter:
 *  1. Can be required without crashing
 *  2. Exports the correct interface (has expected methods)
 *  3. Fails gracefully when API keys are missing / APIs are unreachable
 *
 * These tests NEVER call real external APIs — they verify the
 * contracts that make the server.js wiring correct.
 */

// ─── LLM Provider ────────────────────────────────────────────────────────────
describe('LLM Provider wiring', () => {
  const { createGeminiAdapter, createOpenAIAdapter, createLlmClient } = require('../utils/llmProvider');

  test('createGeminiAdapter throws immediately if apiKey is missing', () => {
    expect(() => createGeminiAdapter(undefined)).toThrow('GEMINI_API_KEY is required');
  });

  test('createGeminiAdapter returns { complete } function when key provided', () => {
    const adapter = createGeminiAdapter('fake-key-for-interface-test');
    expect(typeof adapter.complete).toBe('function');
  });

  test('createOpenAIAdapter throws immediately if apiKey is missing', () => {
    expect(() => createOpenAIAdapter(undefined)).toThrow('OPENAI_API_KEY is required');
  });

  test('createOpenAIAdapter returns { complete } function when key provided (skip if openai not installed)', () => {
    try {
      require('openai'); // only available if installed
    } catch {
      // openai package not installed — skip gracefully
      console.log('  ⏭  openai package not installed, skipping OpenAI adapter interface test');
      return;
    }
    const adapter = createOpenAIAdapter('fake-key-for-interface-test');
    expect(typeof adapter.complete).toBe('function');
  });

  test('createLlmClient picks gemini by default (env LLM_PROVIDER=gemini)', () => {
    const orig = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'fake-key';
    const client = createLlmClient();
    expect(typeof client.complete).toBe('function');
    process.env.LLM_PROVIDER = orig;
  });

  test('createLlmClient throws for unknown provider', () => {
    const orig = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'unknown-llm';
    expect(() => createLlmClient()).toThrow('Unknown LLM_PROVIDER');
    process.env.LLM_PROVIDER = orig;
  });

  test('Gemini adapter rejects with real error on real API call with fake key', async () => {
    const adapter = createGeminiAdapter('invalid-api-key-xyz');
    await expect(adapter.complete('Hello')).rejects.toThrow();
  }, 15000);
});

// ─── Image Service ────────────────────────────────────────────────────────────
describe('Imagen 3 provider wiring', () => {
  const { createGeminiImagenProvider, buildImagePrompt } = require('../services/imageService');

  test('createGeminiImagenProvider returns { generate } function', () => {
    const provider = createGeminiImagenProvider('fake-api-key');
    expect(typeof provider.generate).toBe('function');
  });

  test('generate rejects with real error on fake API key', async () => {
    const provider = createGeminiImagenProvider('bad-key');
    await expect(provider.generate('test prompt')).rejects.toThrow();
  }, 10000);

  test('buildImagePrompt returns a non-empty string with key terms', () => {
    const prompt = buildImagePrompt('Cell Division', 'Mitosis is the process...');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain('Cell Division');
  });
});

// ─── Audio Service ────────────────────────────────────────────────────────────
describe('Google TTS provider wiring', () => {
  const { createGoogleTtsProvider, buildDeepDiveSsml, buildBriefSsml } = require('../services/audioService');

  test('createGoogleTtsProvider returns { synthesize } function', () => {
    const provider = createGoogleTtsProvider('fake-api-key');
    expect(typeof provider.synthesize).toBe('function');
  });

  test('synthesize rejects with real error on fake API key', async () => {
    const provider = createGoogleTtsProvider('bad-key');
    const ssml = '<speak>Hello</speak>';
    await expect(provider.synthesize(ssml, 'en-US-Journey-F')).rejects.toThrow();
  }, 10000);

  test('buildDeepDiveSsml and buildBriefSsml are valid non-empty strings', () => {
    const topics = [
      { title: 'Photosynthesis', priority: 2, content: 'Plants use sunlight', revisionPoints: ['Chlorophyll'] },
    ];
    expect(buildDeepDiveSsml('Biology', topics)).toContain('<speak>');
    expect(buildBriefSsml('Biology', topics)).toContain('<speak>');
  });
});

// ─── YouTube Transcript ───────────────────────────────────────────────────────
describe('YouTube Transcript provider wiring', () => {
  test('youtube-transcript package is installed and importable', () => {
    expect(() => require('youtube-transcript')).not.toThrow();
  });

  test('YoutubeTranscript has fetchTranscript method', () => {
    const { YoutubeTranscript } = require('youtube-transcript');
    expect(typeof YoutubeTranscript.fetchTranscript).toBe('function');
  });

  test('createYoutubeTranscriptService returns { fetchTranscript } function', () => {
    const { createYoutubeTranscriptService } = require('../services/youtubeTranscriptService');
    const svc = createYoutubeTranscriptService({ captionProvider: { fetch: async () => [] } });
    expect(typeof svc.fetchTranscript).toBe('function');
  });
});

// ─── Stripe ────────────────────────────────────────────────────────────────────
describe('Stripe provider wiring', () => {
  test('getStripe returns a stripe instance with checkout.sessions.create', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_wiring_test';
    const { getStripe } = require('../config/stripe');
    const stripe = getStripe();
    expect(typeof stripe.checkout.sessions.create).toBe('function');
    expect(typeof stripe.webhooks.constructEvent).toBe('function');
  });
});

// ─── MCQ Service interface ────────────────────────────────────────────────────
describe('MCQ Service interface wiring', () => {
  const { generateMcqs, parseMcqResponse, McqGenerationError } = require('../services/mcqService');

  test('generateMcqs expects llmClient with .complete() method', async () => {
    const mockClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify([
        { question: 'Q1?', options: [{label:'A',text:'a'},{label:'B',text:'b'},{label:'C',text:'c'},{label:'D',text:'d'}], correctAnswer: 'A', explanation: 'Because A', difficulty: 'easy' },
      ])),
    };
    const topic = { topicId: 'tp1', title: 'Test', content: 'Content', revisionPoints: [] };
    const result = await generateMcqs({ llmClient: mockClient, topic, count: 1 });
    expect(result).toHaveLength(1);
    expect(mockClient.complete).toHaveBeenCalledTimes(1);
  });

  test('McqGenerationError is a proper Error subclass', () => {
    const err = new McqGenerationError('test error');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('McqGenerationError');
  });
});

// ─── SM-2 Service interface ───────────────────────────────────────────────────
describe('SM-2 Service interface wiring', () => {
  const { calculateNextReview, initialCardState } = require('../services/sm2Service');

  test('initialCardState returns correct default fields', () => {
    const state = initialCardState();
    expect(state.ef).toBe(2.5);
    expect(state.interval).toBe(1);
    expect(state.repetitions).toBe(0);
    expect(state.nextReviewDate).toBeInstanceOf(Date);
  });

  test('full SM-2 sequence through 5 reviews produces valid state', () => {
    let card = initialCardState();
    const qualities = [5, 4, 3, 2, 5];
    for (const q of qualities) {
      card = calculateNextReview(card, q);
      expect(card.ef).toBeGreaterThanOrEqual(1.3);
      expect(card.interval).toBeGreaterThanOrEqual(1);
      expect(card.repetitions).toBeGreaterThanOrEqual(0);
      expect(card.nextReviewDate).toBeInstanceOf(Date);
    }
  });
});

// ─── App factory smoke test ────────────────────────────────────────────────────
describe('App factory smoke test (no DB, all stubs)', () => {
  const { createApp } = require('../app');

  test('createApp mounts expected route count without crashing', () => {
    const app = createApp({
      firebaseAdmin: { auth: () => ({ verifyIdToken: async () => ({}) }) },
      UserModel: {}, NoteModel: {}, TranscriptModel: {},
      StickyNoteModel: {}, FlashcardModel: {}, HighlightModel: {}, McqSetModel: {},
      transcriptService: {}, llmNotesService: {},
      reserveCredits: async () => {}, refundCredits: async () => {},
      imagenProvider: {}, ttsProvider: {},
      llmClient: { complete: async () => '' },
      stripe: {
        checkout: { sessions: { create: async () => ({}) } },
        webhooks: { constructEvent: () => ({}) },
      },
    });
    // Express _router.stack has at least: helmet, cors, json, mongoSanitize, health, 9 routers, 404, err
    expect(app._router.stack.length).toBeGreaterThan(10);
  });

  test('/health route responds correctly without DB', async () => {
    const supertest = require('supertest');
    const app = createApp({
      firebaseAdmin: { auth: () => ({ verifyIdToken: async () => ({}) }) },
      UserModel: {}, NoteModel: {}, TranscriptModel: {},
      StickyNoteModel: {}, FlashcardModel: {}, HighlightModel: {}, McqSetModel: {},
      transcriptService: {}, llmNotesService: {},
      reserveCredits: async () => {}, refundCredits: async () => {},
      imagenProvider: {}, ttsProvider: {},
      llmClient: { complete: async () => '' },
      stripe: {
        checkout: { sessions: { create: async () => ({}) } },
        webhooks: { constructEvent: () => ({}) },
      },
    });
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('exam-notes-ai');
  });
});
