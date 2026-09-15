'use strict';

const request  = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp }  = require('../app');
const User     = require('../models/User');
const Note     = require('../models/Note');
const StickyNote = require('../models/StickyNote');
const Flashcard  = require('../models/Flashcard');
const Highlight  = require('../models/Highlight');
const McqSet     = require('../models/McqSet');
const { reserveCredits, refundCredits, CreditTransaction } = require('../services/creditService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}), Note.deleteMany({}),
    StickyNote.deleteMany({}), Flashcard.deleteMany({}),
    Highlight.deleteMany({}), McqSet.deleteMany({}),
    CreditTransaction.deleteMany({}),
  ]);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeMcqArray(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    question: `Question ${i + 1}?`,
    options: [
      { label: 'A', text: 'Option A' }, { label: 'B', text: 'Option B' },
      { label: 'C', text: 'Option C' }, { label: 'D', text: 'Option D' },
    ],
    correctAnswer: 'A',
    explanation: `Explanation ${i + 1}`,
    difficulty: 'medium',
  }));
}

function buildApp(overrides = {}) {
  return createApp({
    firebaseAdmin: {
      auth: () => ({
        verifyIdToken: async (token) => {
          if (typeof token === 'string' && token.startsWith('tok-')) {
            const uid = token.slice(4);
            return { uid, email: `${uid}@t.com`, name: uid };
          }
          throw new Error('bad token');
        },
      }),
    },
    UserModel: User,
    NoteModel: Note,
    StickyNoteModel: StickyNote,
    FlashcardModel: Flashcard,
    HighlightModel: Highlight,
    McqSetModel: McqSet,
    TranscriptModel: { findOne: async () => null, create: async () => ({}) },
    reserveCredits,
    refundCredits,
    transcriptService: { fetchTranscript: async () => ({ videoId: 'dQw4w9WgXcQ', segments: [], markdown: '# t' }) },
    llmNotesService: { generateNotes: async () => ({ title: 'T', topics: [{ topicId: 'tp1', title: 'Topic A', priority: 2, content: 'content', diagrams: [], revisionPoints: ['pt1'], questions: [] }] }) },
    rateLimiter: (req, res, next) => next(),
    stripe: {
      checkout: { sessions: { create: async () => ({ url: 'https://stripe.com/t' }) } },
      webhooks: { constructEvent: () => { throw new Error('bad sig'); } },
    },
    // Phase 3 mocks
    imagenProvider: { generate: async () => Buffer.from('fake-png').toString('base64') },
    ttsProvider: {
      synthesize: async () => Buffer.from('fake-mp3-audio-data'),
    },
    llmClient: {
      complete: async () => JSON.stringify(makeMcqArray(3)),
    },
    ...overrides,
  });
}

async function seedNote(uid, topicOverrides = {}) {
  const user = await User.create({ firebaseUid: uid, email: `${uid}@t.com`, credits: 200 });
  const note = await Note.create({
    ownerId: user._id,
    source: { type: 'youtube', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' },
    title: 'Test Note',
    topics: [{
      topicId: 'tp1', title: 'Photosynthesis', priority: 2,
      content: 'Plants convert sunlight into glucose using CO2 and water.',
      revisionPoints: ['Chlorophyll', 'Produces oxygen'],
      diagrams: [], questions: [],
      ...topicOverrides
    }],
    status: 'ready',
  });
  return { user, note };
}

const AUTH = uid => ({ Authorization: `Bearer tok-${uid}` });

// ═══════════════════════════════════════════════════════════════════════════
// MCQ GENERATION
// ═══════════════════════════════════════════════════════════════════════════
describe('MCQ API', () => {
  test('POST /mcqs → 201 generates and stores MCQs', async () => {
    const app = buildApp();
    const { note } = await seedNote('alice');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs`)
      .set(AUTH('alice'))
      .send({ count: 3 });

    expect(res.status).toBe(201);
    expect(res.body.mcqSet.questions).toHaveLength(3);
    expect(res.body.mcqSet.questions[0]).toHaveProperty('question');
    expect(res.body.mcqSet.questions[0]).toHaveProperty('correctAnswer');
    expect(res.body.mcqSet.questions[0].options).toHaveLength(4);
  });

  test('POST /mcqs → 404 for unknown note', async () => {
    const app = buildApp();
    await User.create({ firebaseUid: 'bob', email: 'bob@t.com', credits: 100 });
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/notes/${fakeId}/topics/tp1/mcqs`)
      .set(AUTH('bob'))
      .send({});

    expect(res.status).toBe(404);
  });

  test('POST /mcqs → 404 for wrong user note', async () => {
    const app = buildApp();
    const { note } = await seedNote('carol');
    await User.create({ firebaseUid: 'dave', email: 'dave@t.com', credits: 100 });

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs`)
      .set(AUTH('dave'))
      .send({});

    expect(res.status).toBe(404);
  });

  test('GET /mcqs → 200 retrieves generated MCQs', async () => {
    const app = buildApp();
    const { note } = await seedNote('eve');

    await request(app).post(`/api/notes/${note._id}/topics/tp1/mcqs`).set(AUTH('eve')).send({});

    const res = await request(app)
      .get(`/api/notes/${note._id}/topics/tp1/mcqs`)
      .set(AUTH('eve'));

    expect(res.status).toBe(200);
    expect(res.body.mcqSet.questions).toHaveLength(3);
  });

  test('GET /mcqs → 404 when MCQs not yet generated', async () => {
    const app = buildApp();
    const { note } = await seedNote('frank');

    const res = await request(app)
      .get(`/api/notes/${note._id}/topics/tp1/mcqs`)
      .set(AUTH('frank'));

    expect(res.status).toBe(404);
  });

  test('POST /mcqs/submit → 200 grades quiz and returns results', async () => {
    const app = buildApp();
    const { note } = await seedNote('grace');

    // Generate MCQs first
    await request(app).post(`/api/notes/${note._id}/topics/tp1/mcqs`).set(AUTH('grace')).send({});

    // Submit answers — all correct (correctAnswer is 'A')
    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs/submit`)
      .set(AUTH('grace'))
      .send({ answers: [{ questionIndex: 0, selected: 'A' }, { questionIndex: 1, selected: 'A' }, { questionIndex: 2, selected: 'A' }] });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(3);
    expect(res.body.total).toBe(3);
    expect(res.body.percentage).toBe(100);
    expect(res.body.graded[0].correct).toBe(true);
  });

  test('POST /mcqs/submit → wrong answers scored correctly', async () => {
    const app = buildApp();
    const { note } = await seedNote('henry');

    await request(app).post(`/api/notes/${note._id}/topics/tp1/mcqs`).set(AUTH('henry')).send({});

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs/submit`)
      .set(AUTH('henry'))
      .send({ answers: [{ questionIndex: 0, selected: 'B' }] }); // wrong (correct is A)

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    expect(res.body.graded[0].correct).toBe(false);
    expect(res.body.graded[0].correctAnswer).toBe('A');
    expect(res.body.graded[0].explanation).toBeTruthy();
  });

  test('POST /mcqs/submit → 400 with empty answers', async () => {
    const app = buildApp();
    const { note } = await seedNote('ivan');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs/submit`)
      .set(AUTH('ivan'))
      .send({ answers: [] });

    expect(res.status).toBe(400);
  });

  test('POST /mcqs → 502 when LLM returns garbage', async () => {
    const app = buildApp({
      llmClient: { complete: async () => 'not json at all garbage response' },
    });
    const { note } = await seedNote('judy');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/mcqs`)
      .set(AUTH('judy'))
      .send({});

    expect(res.status).toBe(502);
  });

  test('POST /mcqs is idempotent — overwrites existing MCQs', async () => {
    const app = buildApp();
    const { note } = await seedNote('kate');

    await request(app).post(`/api/notes/${note._id}/topics/tp1/mcqs`).set(AUTH('kate')).send({});
    await request(app).post(`/api/notes/${note._id}/topics/tp1/mcqs`).set(AUTH('kate')).send({});

    const count = await McqSet.countDocuments({ noteId: note._id, topicId: 'tp1' });
    expect(count).toBe(1); // upsert — only one document
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION
// ═══════════════════════════════════════════════════════════════════════════
describe('Image Generation API', () => {
  test('POST /image → 202 starts image generation', async () => {
    const app = buildApp({
      imagenProvider: {
        generate: async () => new Promise(resolve => setTimeout(() => resolve('base64png'), 50)),
      },
    });
    const { note } = await seedNote('liam');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/image`)
      .set(AUTH('liam'));

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('pending');
    expect(res.body.topicId).toBe('tp1');
  });

  test('POST /image → 404 for unknown note', async () => {
    const app = buildApp();
    await User.create({ firebaseUid: 'mia', email: 'mia@t.com', credits: 100 });

    const res = await request(app)
      .post(`/api/notes/${new mongoose.Types.ObjectId()}/topics/tp1/image`)
      .set(AUTH('mia'));

    expect(res.status).toBe(404);
  });

  test('POST /image → 404 for unknown topicId', async () => {
    const app = buildApp();
    const { note } = await seedNote('noah');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/nonexistent/image`)
      .set(AUTH('noah'));

    expect(res.status).toBe(404);
  });

  test('GET /image → 200 returns imageStatus', async () => {
    const app = buildApp();
    const { note } = await seedNote('olivia');

    const res = await request(app)
      .get(`/api/notes/${note._id}/topics/tp1/image`)
      .set(AUTH('olivia'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('imageStatus');
    expect(res.body.topicId).toBe('tp1');
  });

  test('POST /image → 401 without auth', async () => {
    const app = buildApp();
    const { note } = await seedNote('pat');

    const res = await request(app)
      .post(`/api/notes/${note._id}/topics/tp1/image`);

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
describe('Audio Overview API', () => {
  test('POST /audio → 202 starts audio generation', async () => {
    const app = buildApp();
    const { note } = await seedNote('quinn');

    const res = await request(app)
      .post(`/api/notes/${note._id}/audio`)
      .set(AUTH('quinn'))
      .send({ format: 'brief' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('pending');
  });

  test('POST /audio → 400 for unknown format', async () => {
    const app = buildApp();
    const { note } = await seedNote('rachel');

    const res = await request(app)
      .post(`/api/notes/${note._id}/audio`)
      .set(AUTH('rachel'))
      .send({ format: 'invalid-format' });

    expect(res.status).toBe(400);
  });

  test('POST /audio → 409 if already pending', async () => {
    const app = buildApp({
      ttsProvider: { synthesize: async () => new Promise(resolve => setTimeout(() => resolve(Buffer.from('mp3')), 5000)) },
    });
    const { note } = await seedNote('sam');

    // Start first
    await request(app).post(`/api/notes/${note._id}/audio`).set(AUTH('sam')).send({ format: 'brief' });
    // Try again immediately — should be pending
    const res = await request(app)
      .post(`/api/notes/${note._id}/audio`)
      .set(AUTH('sam'))
      .send({ format: 'brief' });

    expect(res.status).toBe(409);
  });

  test('GET /audio → 200 returns audioStatus', async () => {
    const app = buildApp();
    const { note } = await seedNote('tina');

    const res = await request(app)
      .get(`/api/notes/${note._id}/audio`)
      .set(AUTH('tina'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('audioStatus');
    expect(res.body).toHaveProperty('audioOverview');
  });

  test('POST /audio → 404 for unknown note', async () => {
    const app = buildApp();
    await User.create({ firebaseUid: 'uma', email: 'uma@t.com', credits: 100 });

    const res = await request(app)
      .post(`/api/notes/${new mongoose.Types.ObjectId()}/audio`)
      .set(AUTH('uma'))
      .send({ format: 'brief' });

    expect(res.status).toBe(404);
  });

  test('POST /audio → 401 without auth', async () => {
    const app = buildApp();
    const { note } = await seedNote('victor');

    const res = await request(app)
      .post(`/api/notes/${note._id}/audio`)
      .send({ format: 'brief' });

    expect(res.status).toBe(401);
  });
});
