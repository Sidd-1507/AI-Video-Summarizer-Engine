'use strict';

const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signLocalToken } = require('../utils/localJwt');
const { CreditTransaction } = require('../services/creditService');

const SIGNUP_BONUS = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user._id.toString(),
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName || '',
    credits: user.credits,
  };
}

function createAuthController({ UserModel }) {
  async function register(req, res) {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim() || email.split('@')[0];

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await UserModel.create({
      firebaseUid: `local-${crypto.randomUUID()}`,
      email,
      displayName,
      passwordHash: hashPassword(password),
      credits: SIGNUP_BONUS,
    });

    await CreditTransaction.create({
      ownerId: user._id,
      type: 'signup_bonus',
      amount: SIGNUP_BONUS,
      balanceAfter: user.credits,
    });

    const token = signLocalToken({ uid: user.firebaseUid, email: user.email });
    return res.status(201).json({ token, user: publicUser(user) });
  }

  async function login(req, res) {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await UserModel.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signLocalToken({ uid: user.firebaseUid, email: user.email });
    return res.json({ token, user: publicUser(user) });
  }

  async function me(req, res) {
    const user = await UserModel.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: publicUser(user) });
  }

  return { register, login, me };
}

module.exports = { createAuthController };
