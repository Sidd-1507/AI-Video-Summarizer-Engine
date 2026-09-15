'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../app');
const User = require('../models/User');
const { CreditTransaction } = require('../services/creditService');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = createApp({
    firebaseAdmin: null,
    UserModel: User,
  });
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  await Promise.all([User.deleteMany({}), CreditTransaction.deleteMany({})]);
});

describe('email/password accounts', () => {
  test('POST /api/auth/register stores the user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: 'supersecret', displayName: 'Ada' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('ada@example.com');
    expect(res.body.user.credits).toBe(100);

    const saved = await User.findOne({ email: 'ada@example.com' }).select('+passwordHash');
    expect(saved).toBeTruthy();
    expect(saved.passwordHash).toBeTruthy();
    expect(saved.passwordHash).not.toContain('supersecret');
  });

  test('POST /api/auth/login issues a token that authenticates /api/auth/me', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'lin@example.com', password: 'supersecret' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lin@example.com', password: 'supersecret' });

    expect(login.status).toBe(200);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('lin@example.com');
  });

  test('duplicate email is rejected', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'supersecret' });
    expect(res.status).toBe(409);
  });

  test('wrong password is rejected', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'pw@example.com', password: 'supersecret' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pw@example.com', password: 'nope-nope' });
    expect(res.status).toBe(401);
  });
});
