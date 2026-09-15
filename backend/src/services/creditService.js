const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['purchase', 'generation_charge', 'refund', 'signup_bonus'],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    refId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits');
    this.name = 'InsufficientCreditsError';
    this.statusCode = 402;
  }
}

/**
 * Atomically deducts `amount` credits from a user, using a conditional
 * update (credits >= amount) so two concurrent requests can never both
 * succeed against a balance that only covers one of them (no
 * read-then-write race).
 */
async function reserveCredits(User, userId, amount) {
  const updated = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    { $inc: { credits: -amount } },
    { new: true }
  );
  if (!updated) throw new InsufficientCreditsError();

  await CreditTransaction.create({
    ownerId: userId,
    type: 'generation_charge',
    amount: -amount,
    balanceAfter: updated.credits,
  });

  return updated.credits;
}

async function refundCredits(User, userId, amount, refId) {
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { credits: amount } },
    { new: true }
  );
  await CreditTransaction.create({
    ownerId: userId,
    type: 'refund',
    amount,
    balanceAfter: updated ? updated.credits : amount,
    refId,
  });
}

async function grantCredits(User, userId, amount, type, refId) {
  if (!['purchase', 'signup_bonus'].includes(type)) {
    throw new Error('grantCredits type must be purchase or signup_bonus');
  }
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { credits: amount } },
    { new: true }
  );
  if (!updated) throw new Error('User not found');

  await CreditTransaction.create({
    ownerId: userId,
    type,
    amount,
    balanceAfter: updated.credits,
    refId,
  });

  return updated.credits;
}

module.exports = {
  reserveCredits,
  refundCredits,
  grantCredits,
  InsufficientCreditsError,
  CreditTransaction,
};
