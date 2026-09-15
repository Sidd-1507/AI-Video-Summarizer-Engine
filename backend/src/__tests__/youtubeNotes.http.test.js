const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const rateLimit = require('express-rate-limit');

const { createApp } = require('../app');
const User = require('../models/User');
const Note = require('../models/Note');
const Transcript = require('../models/Transcript');
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
  await User.deleteMany({});
  await Note.deleteMany({});
  await Transcript.deleteMany({});
  await CreditTransaction.deleteMany({});
  await require('../models/Job').deleteMany({});
});

// Fake Firebase admin: token "valid-token-<uid>" decodes to that uid, anything else fails.
function fakeFirebaseAdmin() {
  return {
    auth: () => ({
      verifyIdToken: async (token) => {
        if (typeof token === 'string' && token.startsWith('valid-token-')) {
          const uid = token.replace('valid-token-', '');
          return { uid, email: `${uid}@example.com`, name: uid };
        }
        throw new Error('invalid token');
      },
    }),
  };
}

function buildApp(overrides = {}) {
  return createApp({
    firebaseAdmin: fakeFirebaseAdmin(),
    UserModel: User,
    TranscriptModel: Transcript,
    NoteModel: Note,
    reserveCredits,
    refundCredits,
    transcriptService: {
      fetchTranscript: async () => ({
        videoId: 'dQw4w9WgXcQ',
        segments: [{ start: 0, text: 'hello world' }],
        markdown: '# Transcript\n\nhello world',
      }),
    },
    llmNotesService: {
      generateNotes: async () => ({
        title: 'Generated Title',
        topics: [
          { topicId: 't1', title: 'Topic A', priority: 2, content: 'c', diagrams: [], revisionPoints: [], questions: [] },
        ],
      }),
    },
    // Disable real rate limiting by default so unrelated tests aren't flaky;
    // the dedicated rate-limit test below wires a tiny limiter explicitly.
    rateLimiter: (req, res, next) => next(),
    ...overrides,
  });
}

describe('POST /api/youtube-notes', () => {
  test('401 when no Authorization header is present', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/youtube-notes').send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(res.status).toBe(401);
  });

  test('401 with an invalid/expired token', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer garbage-token')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(res.status).toBe(401);
  });

  test('provisions a new user with the signup bonus on first authenticated request', async () => {
    const app = buildApp();
    // Use a request that hits auth (provisions the user) but fails validation
    // (no youtubeUrl body) so NO credits are deducted — lets us verify signup bonus.
    await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-newuser')
      .send({}); // missing youtubeUrl → 400 before credit deduction

    const user = await User.findOne({ firebaseUid: 'newuser' });
    expect(user).not.toBeNull();
    // Signup bonus = 100, no credits charged (request failed at validation)
    expect(user.credits).toBe(100);
  });

  test('201 happy path creates and returns a note scoped to the caller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-alice')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', classLevel: '10', board: 'CBSE' });

    expect(res.status).toBe(201);
    expect(res.body.note.title).toBe('Generated Title');
    const alice = await User.findOne({ firebaseUid: 'alice' });
    expect(res.body.note.ownerId).toBe(alice._id.toString());
  });

  test('400 when youtubeUrl is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-bob')
      .send({});
    expect(res.status).toBe(400);
  });

  test('400 when youtubeUrl is not a valid URL at all', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-bob')
      .send({ youtubeUrl: 'not a url' });
    expect(res.status).toBe(400);
  });

  test('422 when the video has no captions, and the user is not charged', async () => {
    const app = buildApp({
      transcriptService: {
        fetchTranscript: async () => {
          const { NoCaptionsError } = require('../services/youtubeTranscriptService');
          throw new NoCaptionsError('dQw4w9WgXcQ');
        },
      },
    });

    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-carol')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(res.status).toBe(422);
    const carol = await User.findOne({ firebaseUid: 'carol' });
    expect(carol.credits).toBe(100); // untouched — refunded fully
  });

  test('402 when the user has insufficient credits', async () => {
    const app = buildApp();
    await User.create({ firebaseUid: 'poor', email: 'poor@example.com', credits: 1 });

    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-poor')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(res.status).toBe(402);
  });

  test('rejects a NoSQL-injection-style payload for youtubeUrl (object instead of string)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-eve')
      .send({ youtubeUrl: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('rejects an oversized request body', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-mallory')
      // 11MB — exceeds the 10mb express.json limit → 413
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', extra: 'X'.repeat(11_000_000) });
    expect(res.status).toBe(413); // payload too large, rejected before reaching handler
  });

  test('does not leak internal error details when the LLM service throws unexpectedly', async () => {
    const app = buildApp({
      llmNotesService: {
        generateNotes: async () => {
          throw new Error('secret internal stack trace with DB connection string');
        },
      },
    });
    const res = await request(app)
      .post('/api/youtube-notes')
      .set('Authorization', 'Bearer valid-token-trent')
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/connection string/);
  });

  test('enforces per-user rate limiting on the generation endpoint', async () => {
    const app = buildApp({
      rateLimiter: rateLimit({
        windowMs: 60_000,
        max: 2,
        keyGenerator: (req) => req.user?.id || req.ip,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    });

    const auth = { Authorization: 'Bearer valid-token-rate' };
    const body = { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' };

    const first = await request(app).post('/api/youtube-notes').set(auth).send(body);
    const second = await request(app).post('/api/youtube-notes').set(auth).send(body);
    const third = await request(app).post('/api/youtube-notes').set(auth).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
  });
});
