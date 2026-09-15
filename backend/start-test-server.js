'use strict';
/**
 * start-test-server.js
 * Runs the real createApp() with:
 *  - mongodb-memory-server (no external MongoDB needed)
 *  - Stub services (transcript, LLM, Imagen, TTS, Stripe)
 *  - Auth middleware that accepts Bearer fake-guest-token → user1,
 *    Bearer fake-guest-token-2 → user2 (for ownership tests),
 *    and rejects everything else with 401
 */

// Set test environment variables BEFORE requiring any app modules
process.env.STRIPE_PRICE_50CR  = 'price_test_50cr';
process.env.STRIPE_PRICE_120CR = 'price_test_120cr';
process.env.STRIPE_PRICE_300CR = 'price_test_300cr';
process.env.FRONTEND_URL = 'http://localhost:5173';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('./src/app');

// Models
const UserModel       = require('./src/models/User');
const NoteModel       = require('./src/models/Note');
const TranscriptModel = require('./src/models/Transcript');
const StickyNoteModel = require('./src/models/StickyNote');
const FlashcardModel  = require('./src/models/Flashcard');
const HighlightModel  = require('./src/models/Highlight');
const JobModel        = require('./src/models/Job');

async function run() {
  // ── 1. In-memory MongoDB ─────────────────────────────────────────────────
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('[DevServer] In-memory MongoDB connected.');

  // ── 2. Seed two users ─────────────────────────────────────────────────────
  const user1 = await UserModel.create({
    firebaseUid: 'uid_user1', email: 'user1@test.com', credits: 500,
  });
  const user2 = await UserModel.create({
    firebaseUid: 'uid_user2', email: 'user2@test.com', credits: 500,
  });

  // ── 3. Stub services ──────────────────────────────────────────────────────
  const transcriptService = {
    // The orchestrator calls: transcriptService.fetchTranscript(youtubeUrl)
    fetchTranscript: async (youtubeUrl) => {
      const { extractVideoId } = require('./src/utils/youtubeUrl');
      const videoId = extractVideoId(youtubeUrl);
      return {
        videoId,
        segments: [
          { start: 0, text: 'Hello and welcome to this lecture on photosynthesis.' },
          { start: 5, text: 'Today we will cover light reactions and the Calvin cycle.' },
        ],
        markdown: '## Photosynthesis\n\nHello and welcome...\n\nToday we will cover light reactions and the Calvin cycle.',
      };
    },
  };

  const llmNotesService = {
    // The orchestrator calls: llmNotesService.generateNotes(markdown, options)
    // and expects: { title: string, topics: Topic[] }
    generateNotes: async (markdown, options) => ({
      title: 'Photosynthesis: Light Reactions & Calvin Cycle',
      topics: [
        {
          topicId: 't1',
          title:   'Introduction to Photosynthesis',
          priority: 1,
          content: 'Photosynthesis converts sunlight into chemical energy stored as glucose.',
          diagrams: [],
          revisionPoints: [
            'Light is absorbed by chlorophyll in the thylakoid membrane.',
            'CO2 is fixed in the stroma via the Calvin Cycle.',
            'Overall: 6CO2 + 6H2O + light → C6H12O6 + 6O2',
          ],
          questions: [
            { type: 'short', text: 'What is the role of ATP in the Calvin cycle?', answer: 'ATP provides energy to drive the reduction of CO2 to G3P.' },
          ],
        },
        {
          topicId: 't2',
          title:   'The Calvin Cycle',
          priority: 2,
          content: 'The Calvin cycle uses ATP and NADPH from the light reactions to fix CO2 into glucose.',
          diagrams: [],
          revisionPoints: [
            'Occurs in the stroma of the chloroplast.',
            'RuBisCO is the key enzyme that fixes CO2.',
            '3 turns produce one G3P molecule.',
          ],
          questions: [
            { type: 'short', text: 'Why is RuBisCO considered the most important enzyme?', answer: 'Because it catalyses the first step of carbon fixation in all plants.' },
          ],
        },
      ],
    }),
  };

  // The orchestrator calls: reserveCredits(UserModel, userId, amount)
  const reserveCredits = async (UserModelArg, userId, amount) => {
    const user = await UserModel.findById(userId);
    if (!user || user.credits < amount) {
      const { InsufficientCreditsError } = require('./src/services/creditService');
      throw new InsufficientCreditsError('Not enough credits');
    }
    await UserModel.findByIdAndUpdate(userId, { $inc: { credits: -amount } });
    return true;
  };

  // The orchestrator calls: refundCredits(UserModel, userId, amount, noteId?)
  const refundCredits = async (UserModelArg, userId, amount) => {
    await UserModel.findByIdAndUpdate(userId, { $inc: { credits: amount } });
  };

  const rateLimiter = (req, res, next) => next(); // No rate limiting in test

  // Phase 3 stubs
  const imagenProvider = { generate: async () => Buffer.from('fake-png-image-data') };
  const ttsProvider    = { synthesize: async () => Buffer.from('fake-mp3-audio-data') };
  const llmClient      = {
    complete: async (prompt) => JSON.stringify({
      questions: [
        { question: 'What is photosynthesis?', options: [{ label: 'A', text: 'Light to chemical energy' }, { label: 'B', text: 'Chemical to light' }, { label: 'C', text: 'Digestion' }, { label: 'D', text: 'Respiration' }], correctAnswer: 'A', explanation: 'Photosynthesis converts light energy to glucose.', difficulty: 'easy' },
        { question: 'Where does the Calvin cycle occur?', options: [{ label: 'A', text: 'Thylakoid' }, { label: 'B', text: 'Stroma' }, { label: 'C', text: 'Matrix' }, { label: 'D', text: 'Cytoplasm' }], correctAnswer: 'B', explanation: 'The Calvin cycle occurs in the stroma.', difficulty: 'medium' },
        { question: 'What gas is released?', options: [{ label: 'A', text: 'CO2' }, { label: 'B', text: 'N2' }, { label: 'C', text: 'O2' }, { label: 'D', text: 'H2' }], correctAnswer: 'C', explanation: 'Oxygen is released as a byproduct.', difficulty: 'easy' },
        { question: 'Key pigment?', options: [{ label: 'A', text: 'Melanin' }, { label: 'B', text: 'Chlorophyll' }, { label: 'C', text: 'Haemoglobin' }, { label: 'D', text: 'Carotene' }], correctAnswer: 'B', explanation: 'Chlorophyll absorbs light for photosynthesis.', difficulty: 'easy' },
        { question: 'RuBisCO function?', options: [{ label: 'A', text: 'Light absorption' }, { label: 'B', text: 'ATP synthesis' }, { label: 'C', text: 'CO2 fixation' }, { label: 'D', text: 'O2 release' }], correctAnswer: 'C', explanation: 'RuBisCO catalyses CO2 fixation in the Calvin cycle.', difficulty: 'hard' },
      ],
    }),
  };

  const stripe = {
    checkout: {
      sessions: {
        create: async ({ line_items }) => ({ url: 'https://checkout.stripe.com/test_session_abc123' }),
      },
    },
    webhooks: {
      constructEvent: () => { throw new Error('No webhook secret in test mode'); },
    },
  };

  // ── 4. Fake Firebase Admin — maps tokens to user records ─────────────────
  const TOKEN_MAP = {
    'fake-guest-token':   { uid: 'uid_user1', email: 'user1@test.com' },
    'fake-guest-token-2': { uid: 'uid_user2', email: 'user2@test.com' },
  };

  const firebaseAdmin = {
    auth: () => ({
      verifyIdToken: async (token) => {
        const decoded = TOKEN_MAP[token];
        if (!decoded) throw Object.assign(new Error('Invalid token'), { code: 'auth/invalid-id-token' });
        return decoded;
      },
    }),
  };

  // ── 5. Create and start app ────────────────────────────────────────────────
  const app = createApp({
    firebaseAdmin,
    UserModel, NoteModel, TranscriptModel, StickyNoteModel,
    FlashcardModel, HighlightModel, McqSetModel, JobModel,
    transcriptService, llmNotesService,
    reserveCredits, refundCredits, rateLimiter,
    imagenProvider, ttsProvider, llmClient, stripe,
    runJobsSync: true,
  });

  app.listen(3001, '0.0.0.0', () => {
    console.log('[DevServer] ✅ Backend running at http://localhost:3001');
    console.log('[DevServer] Tokens: fake-guest-token (user1) | fake-guest-token-2 (user2)');
    console.log('[DevServer] Stub mode: LLM, Imagen, TTS, Stripe all stubbed');
  });
}

run().catch((err) => {
  console.error('[DevServer] Fatal:', err.stack || err.message);
  process.exit(1);
});
