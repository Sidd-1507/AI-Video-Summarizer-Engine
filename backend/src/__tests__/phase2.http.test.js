'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const User = require('../models/User');
const Note = require('../models/Note');
const StickyNote = require('../models/StickyNote');
const Flashcard = require('../models/Flashcard');
const Highlight = require('../models/Highlight');
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
    User.deleteMany({}),
    Note.deleteMany({}),
    StickyNote.deleteMany({}),
    Flashcard.deleteMany({}),
    Highlight.deleteMany({}),
    CreditTransaction.deleteMany({}),
  ]);
});

// ─── Fake deps ──────────────────────────────────────────────────────────────

function fakeFirebase() {
  return {
    auth: () => ({
      verifyIdToken: async (token) => {
        if (typeof token === 'string' && token.startsWith('valid-token-')) {
          const uid = token.replace('valid-token-', '');
          return { uid, email: `${uid}@test.com`, name: uid };
        }
        throw new Error('invalid token');
      },
    }),
  };
}

function buildApp(overrides = {}) {
  return createApp({
    firebaseAdmin: fakeFirebase(),
    UserModel: User,
    NoteModel: Note,
    StickyNoteModel: StickyNote,
    FlashcardModel: Flashcard,
    HighlightModel: Highlight,
    TranscriptModel: { findOne: async () => null, create: async () => ({}) },
    reserveCredits,
    refundCredits,
    transcriptService: {
      fetchTranscript: async () => ({ videoId: 'dQw4w9WgXcQ', segments: [], markdown: '# t' }),
    },
    llmNotesService: {
      generateNotes: async () => ({
        title: 'Test Note',
        topics: [{ topicId: 'tp1', title: 'Topic A', priority: 2, content: 'content', diagrams: [], revisionPoints: ['Point 1', 'Point 2'], questions: [] }],
      }),
    },
    rateLimiter: (req, res, next) => next(),
    stripe: {
      checkout: {
        sessions: {
          create: async () => ({ url: 'https://checkout.stripe.com/test' }),
        },
      },
      webhooks: {
        constructEvent: () => ({ type: 'other.event', data: { object: {} } }),
      },
    },
    ...overrides,
  });
}

// ─── Helper: create a user and a note ───────────────────────────────────────
async function createUserAndNote(uid, topicOverrides = {}) {
  const user = await User.create({ firebaseUid: uid, email: `${uid}@test.com`, credits: 100 });
  const note = await Note.create({
    ownerId: user._id,
    source: { type: 'youtube', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' },
    title: 'Test Note',
    topics: [{ topicId: 'tp1', title: 'Topic A', priority: 2, content: 'Detailed content for Topic A', revisionPoints: ['Point 1', 'Point 2'], diagrams: [], questions: [], ...topicOverrides }],
    status: 'ready',
  });
  return { user, note };
}

// ═══════════════════════════════════════════════════════════════════════════
// STICKY NOTES
// ═══════════════════════════════════════════════════════════════════════════
describe('Sticky Notes API', () => {
  const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });

  test('POST /api/notes/:noteId/sticky-notes → 201 creates sticky note', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('alice');
    const res = await request(app)
      .post(`/api/notes/${note._id}/sticky-notes`)
      .set(AUTH('alice'))
      .send({ topicId: 'tp1', content: 'Remember this!', color: 'green', youtubeTimestamp: 120 });

    expect(res.status).toBe(201);
    expect(res.body.stickyNote.content).toBe('Remember this!');
    expect(res.body.stickyNote.color).toBe('green');
    expect(res.body.stickyNote.youtubeTimestamp).toBe(120);
  });

  test('POST /api/notes/:noteId/sticky-notes → 404 for another user note', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('bob');
    await User.create({ firebaseUid: 'charlie', email: 'charlie@test.com', credits: 100 });

    const res = await request(app)
      .post(`/api/notes/${note._id}/sticky-notes`)
      .set(AUTH('charlie'))
      .send({ topicId: 'tp1', content: 'Should fail' });

    expect(res.status).toBe(404);
  });

  test('POST /api/notes/:noteId/sticky-notes → 400 when content missing', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('dave');
    const res = await request(app)
      .post(`/api/notes/${note._id}/sticky-notes`)
      .set(AUTH('dave'))
      .send({ topicId: 'tp1' }); // no content
    expect(res.status).toBe(400);
  });

  test('GET /api/notes/:noteId/sticky-notes → 200 lists user sticky notes', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('eve');
    await StickyNote.create({ ownerId: (await User.findOne({ firebaseUid: 'eve' }))._id, noteId: note._id, topicId: 'tp1', content: 'Note 1' });
    await StickyNote.create({ ownerId: (await User.findOne({ firebaseUid: 'eve' }))._id, noteId: note._id, topicId: 'tp1', content: 'Note 2' });

    const res = await request(app)
      .get(`/api/notes/${note._id}/sticky-notes`)
      .set(AUTH('eve'));

    expect(res.status).toBe(200);
    expect(res.body.stickyNotes).toHaveLength(2);
  });

  test('PATCH /api/sticky-notes/:id → 200 updates content', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('frank');
    const sticky = await StickyNote.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', content: 'Old' });

    const res = await request(app)
      .patch(`/api/sticky-notes/${sticky._id}`)
      .set(AUTH('frank'))
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.stickyNote.content).toBe('Updated content');
  });

  test('DELETE /api/sticky-notes/:id → 204 deletes own sticky note', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('grace');
    const sticky = await StickyNote.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', content: 'Delete me' });

    const res = await request(app)
      .delete(`/api/sticky-notes/${sticky._id}`)
      .set(AUTH('grace'));

    expect(res.status).toBe(204);
    expect(await StickyNote.findById(sticky._id)).toBeNull();
  });

  test('DELETE /api/sticky-notes/:id → 404 cannot delete another user sticky note', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('henry');
    const sticky = await StickyNote.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', content: 'Protected' });
    await User.create({ firebaseUid: 'ivan', email: 'ivan@test.com', credits: 100 });

    const res = await request(app)
      .delete(`/api/sticky-notes/${sticky._id}`)
      .set(AUTH('ivan'));

    expect(res.status).toBe(404);
    expect(await StickyNote.findById(sticky._id)).not.toBeNull(); // untouched
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FLASHCARDS
// ═══════════════════════════════════════════════════════════════════════════
describe('Flashcards API', () => {
  const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });

  test('POST /generate → 201 creates flashcards for all topics', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('judy');

    const res = await request(app)
      .post(`/api/notes/${note._id}/flashcards/generate`)
      .set(AUTH('judy'));

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.flashcards[0].front).toContain('Topic A');
  });

  test('POST /generate is idempotent — re-generating skips existing topics', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('kate');

    await request(app).post(`/api/notes/${note._id}/flashcards/generate`).set(AUTH('kate'));
    const second = await request(app).post(`/api/notes/${note._id}/flashcards/generate`).set(AUTH('kate'));

    expect(second.body.created).toBe(0);
  });

  test('GET /api/notes/:noteId/flashcards → 200 lists all cards', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('liam');
    await request(app).post(`/api/notes/${note._id}/flashcards/generate`).set(AUTH('liam'));

    const res = await request(app)
      .get(`/api/notes/${note._id}/flashcards`)
      .set(AUTH('liam'));

    expect(res.status).toBe(200);
    expect(res.body.flashcards).toHaveLength(1);
  });

  test('POST /api/flashcards/:id/review → 200 applies SM-2', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('mia');
    const card = await Flashcard.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', front: 'Q', back: 'A' });

    const res = await request(app)
      .post(`/api/flashcards/${card._id}/review`)
      .set(AUTH('mia'))
      .send({ quality: 5 });

    expect(res.status).toBe(200);
    expect(res.body.flashcard.ef).toBeGreaterThan(2.5); // EF increases on q=5
    expect(res.body.flashcard.repetitions).toBe(1);
  });

  test('POST /api/flashcards/:id/review → 400 on invalid quality', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('noah');
    const card = await Flashcard.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', front: 'Q', back: 'A' });

    const res = await request(app)
      .post(`/api/flashcards/${card._id}/review`)
      .set(AUTH('noah'))
      .send({ quality: 9 }); // out of range

    expect(res.status).toBe(400);
  });

  test('DELETE /api/flashcards/:id → 204', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('olivia');
    const card = await Flashcard.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', front: 'Q', back: 'A' });

    const res = await request(app)
      .delete(`/api/flashcards/${card._id}`)
      .set(AUTH('olivia'));

    expect(res.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HIGHLIGHTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Highlights API', () => {
  const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });

  test('POST /api/notes/:noteId/highlights → 201', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('pat');
    const res = await request(app)
      .post(`/api/notes/${note._id}/highlights`)
      .set(AUTH('pat'))
      .send({ topicId: 'tp1', text: 'Key concept', startOffset: 0, endOffset: 11, color: 'blue' });

    expect(res.status).toBe(201);
    expect(res.body.highlight.text).toBe('Key concept');
  });

  test('POST → 400 when endOffset <= startOffset', async () => {
    const app = buildApp();
    const { note } = await createUserAndNote('quinn');
    const res = await request(app)
      .post(`/api/notes/${note._id}/highlights`)
      .set(AUTH('quinn'))
      .send({ topicId: 'tp1', text: 'x', startOffset: 10, endOffset: 5 });

    expect(res.status).toBe(400);
  });

  test('GET /api/notes/:noteId/highlights → 200', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('rachel');
    await Highlight.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', text: 'hi', startOffset: 0, endOffset: 2 });

    const res = await request(app)
      .get(`/api/notes/${note._id}/highlights`)
      .set(AUTH('rachel'));

    expect(res.status).toBe(200);
    expect(res.body.highlights).toHaveLength(1);
  });

  test('DELETE /api/highlights/:id → 204', async () => {
    const app = buildApp();
    const { note, user } = await createUserAndNote('sam');
    const h = await Highlight.create({ ownerId: user._id, noteId: note._id, topicId: 'tp1', text: 'del', startOffset: 0, endOffset: 3 });

    const res = await request(app)
      .delete(`/api/highlights/${h._id}`)
      .set(AUTH('sam'));
    expect(res.status).toBe(204);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CREDITS
// ═══════════════════════════════════════════════════════════════════════════
describe('Credits API', () => {
  const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });

  test('GET /api/credits/balance → 200 returns current balance', async () => {
    const app = buildApp();
    await User.create({ firebaseUid: 'tina', email: 'tina@test.com', credits: 75 });

    const res = await request(app)
      .get('/api/credits/balance')
      .set(AUTH('tina'));

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(75);
  });

  test('GET /api/credits/history → 200 includes signup bonus for a new user', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/credits/history')
      .set(AUTH('uma'));

    expect(res.status).toBe(200);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].description).toBe('Signup bonus');
    expect(res.body.transactions[0].type).toBe('grant');
    expect(res.body.total).toBe(1);
  });

  test('GET /api/credits/balance → 401 without auth', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/credits/balance');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE
// ═══════════════════════════════════════════════════════════════════════════
describe('Stripe API', () => {
  const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });
  const FAKE_PRICE = 'price_fake50';

  test('POST /api/stripe/checkout → 200 returns checkout URL', async () => {
    // Set up a matching price in the env for this test
    process.env.STRIPE_PRICE_50CR = FAKE_PRICE;
    const app = buildApp({
      stripe: {
        checkout: { sessions: { create: async () => ({ url: 'https://stripe.com/test-url' }) } },
        webhooks: { constructEvent: () => ({ type: 'other', data: { object: {} } }) },
      },
    });

    await User.create({ firebaseUid: 'victor', email: 'v@test.com', credits: 100 });

    const res = await request(app)
      .post('/api/stripe/checkout')
      .set(AUTH('victor'))
      .send({ priceId: FAKE_PRICE });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('stripe.com');
  });

  test('POST /api/stripe/checkout → 400 for unknown priceId', async () => {
    process.env.STRIPE_PRICE_50CR  = FAKE_PRICE;
    process.env.STRIPE_PRICE_120CR = 'price_fake120';
    process.env.STRIPE_PRICE_300CR = 'price_fake300';
    const app = buildApp({
      stripe: {
        checkout: { sessions: { create: async () => ({ url: 'https://stripe.com/t' }) } },
        webhooks: { constructEvent: () => ({ type: 'other', data: { object: {} } }) },
      },
    });
    // Pre-seed the user so auth doesn't fail
    await User.create({ firebaseUid: 'wendy', email: 'w@test.com', credits: 100 });

    const res = await request(app)
      .post('/api/stripe/checkout')
      .set(AUTH('wendy'))
      .send({ priceId: 'price_this_is_unknown_xyz' });

    expect(res.status).toBe(400);
  });

  test('POST /api/stripe/webhook → 400 on bad signature', async () => {
    const app = buildApp({
      stripe: {
        checkout: { sessions: { create: async () => ({ url: '' }) } },
        webhooks: {
          constructEvent: () => { throw new Error('Bad signature'); },
        },
      },
    });

    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'bad-sig')
      .send('raw-body');

    expect(res.status).toBe(400);
  });
});
