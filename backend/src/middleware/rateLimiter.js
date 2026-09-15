const rateLimit = require('express-rate-limit');

/**
 * Keyed by authenticated user id (not IP) so it can't be trivially
 * bypassed by rotating IPs, and so shared-IP users (school labs,
 * offices) don't rate-limit each other.
 */
const generationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many generation requests. Please wait a few minutes and try again.' },
});

const youtubeNotesRateLimiter = generationRateLimiter;

module.exports = { youtubeNotesRateLimiter, generationRateLimiter };
