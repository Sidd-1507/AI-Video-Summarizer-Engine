'use strict';

const { CreditTransaction } = require('../services/creditService');
const { verifyLocalToken } = require('../utils/localJwt');

const SIGNUP_BONUS = 100;

/**
 * Accepts a Notewise JWT (email/password accounts) or a Firebase ID token.
 */
function createAuthMiddleware({ firebaseAdmin, UserModel }) {
  return async function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');

      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
      }

      let uid;
      let email;
      let name;

      const local = verifyLocalToken(token);
      if (local?.uid) {
        uid = local.uid;
        email = local.email;
        name = local.email;
      } else if (firebaseAdmin?.auth) {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        uid = decoded.uid;
        email = decoded.email;
        name = decoded.name;
      } else {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      let user = await UserModel.findOne({ firebaseUid: uid });
      if (!user) {
        user = await UserModel.create({
          firebaseUid: uid,
          email: email || `${uid}@users.invalid`,
          displayName: name || email || uid,
          credits: SIGNUP_BONUS,
        });
        await CreditTransaction.create({
          ownerId: user._id,
          type: 'signup_bonus',
          amount: SIGNUP_BONUS,
          balanceAfter: user.credits,
        });
      }

      req.user = { id: user._id.toString(), firebaseUid: user.firebaseUid };
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { createAuthMiddleware };
