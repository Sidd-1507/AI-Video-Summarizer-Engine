'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const User = require('../models/User');
const Note = require('../models/Note');
const Transcript = require('../models/Transcript');
const Job = require('../models/Job');
const { reserveCredits, refundCredits, CreditTransaction } = require('../services/creditService');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  await Promise.all([
    User.deleteMany({}),
    Note.deleteMany({}),
    Transcript.deleteMany({}),
    Job.deleteMany({}),
    CreditTransaction.deleteMany({}),
  ]);
});

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
    JobModel: Job,
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
      generateNotes: async (_material, options = {}) => ({
        title: options.tone === 'eli5' ? 'Easy Title' : 'Generated Title',
        topics: [
          {
            topicId: 't1',
            title: 'Topic A',
            priority: 2,
            content: 'c',
            diagrams: options.includeDiagrams ? ['graph TD; A-->B'] : [],
            charts: options.includeCharts ? [{ type: 'bar', title: 'X', data: [{ name: 'a', value: 1 }] }] : [],
            revisionPoints: ['r1'],
            questions: [{ type: 'short', text: 'Q?', answer: 'A' }],
          },
        ],
      }),
    },
    rateLimiter: (req, res, next) => next(),
    runJobsSync: true,
    ...overrides,
  });
}

const AUTH = (uid) => ({ Authorization: `Bearer valid-token-${uid}` });

describe('POST /api/topic-notes', () => {
  test('201 creates a topic-sourced note and charges credits', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/topic-notes')
      .set(AUTH('alice'))
      .send({
        topic: 'Photosynthesis',
        classLevel: '10',
        board: 'CBSE',
        examType: 'boards',
        revisionMode: true,
        includeDiagrams: true,
        includeCharts: true,
        tone: 'exam-cram',
      });

    expect(res.status).toBe(201);
    expect(res.body.note.source.type).toBe('topic');
    expect(res.body.note.title).toBe('Generated Title');
    expect(res.body.jobId).toBeDefined();
    expect(res.body.note.topics[0].diagrams.length).toBe(1);
    expect(res.body.note.topics[0].charts.length).toBe(1);

    const alice = await User.findOne({ firebaseUid: 'alice' });
    expect(alice.credits).toBe(80);
  });

  test('400 when topic is missing', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/topic-notes')
      .set(AUTH('bob'))
      .send({ classLevel: '10' });
    expect(res.status).toBe(400);
  });

  test('401 without auth', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/topic-notes').send({ topic: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notes/:id optimistic lock', () => {
  test('updates content and bumps version', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/topic-notes')
      .set(AUTH('cara'))
      .send({ topic: 'Mitosis' });
    const id = created.body.note._id;

    const res = await request(app)
      .patch(`/api/notes/${id}`)
      .set(AUTH('cara'))
      .send({ version: 1, title: 'Mitosis (edited)' });

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('Mitosis (edited)');
    expect(res.body.note.version).toBe(2);
  });

  test('409 when version is stale', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/topic-notes')
      .set(AUTH('dan'))
      .send({ topic: 'Meiosis' });
    const id = created.body.note._id;

    await request(app)
      .patch(`/api/notes/${id}`)
      .set(AUTH('dan'))
      .send({ version: 1, title: 'first' });

    const res = await request(app)
      .patch(`/api/notes/${id}`)
      .set(AUTH('dan'))
      .send({ version: 1, title: 'second' });

    expect(res.status).toBe(409);
    expect(res.body.version).toBe(2);
  });

  test('cannot patch another user note', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/topic-notes')
      .set(AUTH('erin'))
      .send({ topic: 'Osmosis' });

    const res = await request(app)
      .patch(`/api/notes/${created.body.note._id}`)
      .set(AUTH('frank'))
      .send({ version: 1, title: 'stolen' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/jobs/:id and transcript', () => {
  test('returns the caller job and hides others', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/youtube-notes')
      .set(AUTH('gina'))
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    const jobRes = await request(app)
      .get(`/api/jobs/${created.body.jobId}`)
      .set(AUTH('gina'));
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.job.status).toBe('done');

    const other = await request(app)
      .get(`/api/jobs/${created.body.jobId}`)
      .set(AUTH('harry'));
    expect(other.status).toBe(404);
  });

  test('GET /api/notes/:id/transcript returns stored markdown + segments', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/youtube-notes')
      .set(AUTH('ivy'))
      .send({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    const res = await request(app)
      .get(`/api/notes/${created.body.note._id}/transcript`)
      .set(AUTH('ivy'));

    expect(res.status).toBe(200);
    expect(res.body.transcript.markdown).toMatch(/hello world/);
    expect(res.body.transcript.segments).toHaveLength(1);
  });
});

describe('GET /api/credits/packages', () => {
  test('lists the three Stripe packages from the transcript', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/credits/packages')
      .set(AUTH('jade'));
    expect(res.status).toBe(200);
    expect(res.body.packages.map((p) => p.credits)).toEqual([50, 120, 300]);
  });
});
