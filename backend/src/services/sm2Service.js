'use strict';

/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on the SuperMemo SM-2 algorithm (Wozniak, 1987).
 * This is a PURE function — no DB, no side effects. Takes the current
 * card state and a review quality score (0-5) and returns the new state.
 *
 * Quality scale:
 *   5 — perfect response
 *   4 — correct response after a hesitation
 *   3 — correct response recalled with serious difficulty
 *   2 — incorrect response; the correct one seemed easy to recall
 *   1 — incorrect response; the correct one was remembered
 *   0 — complete blackout
 *
 * A quality < 3 is a "lapse" — the interval resets.
 *
 * Returns: { ef, interval, repetitions, nextReviewDate }
 */

const MIN_EF = 1.3;
const INITIAL_EF = 2.5;

/**
 * @param {object} card
 * @param {number} card.ef           - Current easiness factor (≥ 1.3)
 * @param {number} card.interval     - Current interval in days
 * @param {number} card.repetitions  - Successful reviews in a row
 * @param {number} quality           - Review quality 0-5
 * @returns {{ ef: number, interval: number, repetitions: number, nextReviewDate: Date }}
 */
function calculateNextReview(card, quality) {
  if (quality < 0 || quality > 5 || !Number.isInteger(quality)) {
    throw new Error(`SM-2: quality must be an integer 0-5, got ${quality}`);
  }

  let { ef, interval, repetitions } = card;

  // 1. Update EF (always, even on lapse)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEf = Math.max(MIN_EF, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  let newInterval;
  let newRepetitions;

  if (quality < 3) {
    // LAPSE — reset repetitions and interval
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // SUCCESS — advance interval
    newRepetitions = repetitions + 1;

    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      // Round to nearest integer — fractional days make no sense for scheduling
      newInterval = Math.round(interval * newEf);
    }
  }

  // Next review date = today + interval days
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  nextReviewDate.setHours(0, 0, 0, 0); // midnight — compare by day

  return {
    ef: Math.round(newEf * 100) / 100, // 2 decimal places
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate,
  };
}

/**
 * Returns a fresh card state for a brand-new flashcard.
 */
function initialCardState() {
  const nextReviewDate = new Date();
  nextReviewDate.setHours(0, 0, 0, 0);
  return {
    ef: INITIAL_EF,
    interval: 1,
    repetitions: 0,
    nextReviewDate,
  };
}

module.exports = { calculateNextReview, initialCardState, MIN_EF, INITIAL_EF };
