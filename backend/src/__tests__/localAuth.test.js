'use strict';

const { hashPassword, verifyPassword } = require('../utils/password');
const { signLocalToken, verifyLocalToken } = require('../utils/localJwt');

describe('password hashing', () => {
  test('stores a salted hash, not the password', () => {
    const stored = hashPassword('supersecret');
    expect(stored).not.toContain('supersecret');
    expect(verifyPassword('supersecret', stored)).toBe(true);
    expect(verifyPassword('wrong-pass', stored)).toBe(false);
  });
});

describe('local JWT', () => {
  test('round-trips uid and email', () => {
    const token = signLocalToken({ uid: 'local-1', email: 'ada@example.com' });
    const payload = verifyLocalToken(token);
    expect(payload.uid).toBe('local-1');
    expect(payload.email).toBe('ada@example.com');
    expect(payload.iss).toBe('notewise');
  });

  test('rejects a firebase-style mock token', () => {
    expect(verifyLocalToken('valid-token-abc')).toBeNull();
  });
});
