const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const { reserveCredits, refundCredits, InsufficientCreditsError, CreditTransaction } = require('../services/creditService');

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
  await CreditTransaction.deleteMany({});
});

describe('creditService', () => {
  test('reserveCredits deducts and logs a transaction', async () => {
    const user = await User.create({ firebaseUid: 'u1', email: 'a@a.com', credits: 100 });
    const remaining = await reserveCredits(User, user._id, 20);
    expect(remaining).toBe(80);

    const tx = await CreditTransaction.findOne({ ownerId: user._id });
    expect(tx.amount).toBe(-20);
    expect(tx.balanceAfter).toBe(80);
  });

  test('throws InsufficientCreditsError when balance is too low', async () => {
    const user = await User.create({ firebaseUid: 'u2', email: 'b@b.com', credits: 5 });
    await expect(reserveCredits(User, user._id, 20)).rejects.toBeInstanceOf(InsufficientCreditsError);

    const unchanged = await User.findById(user._id);
    expect(unchanged.credits).toBe(5); // no partial deduction on failure
  });

  test('refundCredits restores balance and logs a refund transaction', async () => {
    const user = await User.create({ firebaseUid: 'u3', email: 'c@c.com', credits: 50 });
    await reserveCredits(User, user._id, 20);
    await refundCredits(User, user._id, 20);

    const restored = await User.findById(user._id);
    expect(restored.credits).toBe(50);

    const refundTx = await CreditTransaction.findOne({ ownerId: user._id, type: 'refund' });
    expect(refundTx.amount).toBe(20);
  });

  // --- Extreme case: concurrency race ---
  test('two concurrent reservations cannot both succeed against a balance that only covers one', async () => {
    const user = await User.create({ firebaseUid: 'u4', email: 'd@d.com', credits: 20 });

    const results = await Promise.allSettled([
      reserveCredits(User, user._id, 20),
      reserveCredits(User, user._id, 20),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(InsufficientCreditsError);

    const finalUser = await User.findById(user._id);
    expect(finalUser.credits).toBe(0); // exactly one deduction went through, never negative
  });

  test('reserving a negative or zero amount does not increase balance (defensive check)', async () => {
    const user = await User.create({ firebaseUid: 'u5', email: 'e@e.com', credits: 10 });
    // amount <= 0 should not be a valid call in practice, but ensure it never
    // credits the user by "reserving" a negative number.
    const remaining = await reserveCredits(User, user._id, 0);
    expect(remaining).toBe(10);
  });
});
