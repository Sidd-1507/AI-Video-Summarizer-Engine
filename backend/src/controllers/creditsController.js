'use strict';

const { CreditTransaction } = require('../services/creditService');

const TX_DESCRIPTIONS = {
  purchase: 'Credit purchase',
  generation_charge: 'Notes generation',
  refund: 'Refund for failed generation',
  signup_bonus: 'Signup bonus',
};

const PACKAGES = [
  { id: 'price_50',  credits: 50,  priceUsd: 5,  env: 'STRIPE_PRICE_50CR' },
  { id: 'price_120', credits: 120, priceUsd: 10, env: 'STRIPE_PRICE_120CR' },
  { id: 'price_300', credits: 300, priceUsd: 20, env: 'STRIPE_PRICE_300CR' },
];

function createCreditsController({ UserModel }) {

  async function balance(req, res) {
    try {
      const user = await UserModel.findById(req.user.id).lean();
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ credits: user.credits });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch balance' });
    }
  }

  async function history(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip  = parseInt(req.query.skip)  || 0;

      const transactions = await CreditTransaction.find({ ownerId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await CreditTransaction.countDocuments({ ownerId: req.user.id });

      const mapped = transactions.map((tx) => {
        const isGrant = ['purchase', 'refund', 'signup_bonus'].includes(tx.type);
        return {
          _id: tx._id,
          userId: tx.ownerId,
          amount: Math.abs(tx.amount),
          type: isGrant ? 'grant' : 'deduction',
          ledgerType: tx.type,
          description: TX_DESCRIPTIONS[tx.type] || tx.type,
          balanceAfter: tx.balanceAfter,
          createdAt: tx.createdAt,
        };
      });

      return res.json({ transactions: mapped, total, limit, skip });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch credit history' });
    }
  }

  async function packages(_req, res) {
    return res.json({
      packages: PACKAGES.map((p) => ({
        id: p.id,
        credits: p.credits,
        priceUsd: p.priceUsd,
        stripePriceId: process.env[p.env] || p.id,
      })),
    });
  }

  return { balance, history, packages };
}

module.exports = { createCreditsController, PACKAGES };
