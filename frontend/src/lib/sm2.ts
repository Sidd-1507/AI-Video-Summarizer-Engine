/**
 * Client-side SM-2 Spaced Repetition
 * Mirrors backend sm2Service.js exactly so flashcard grading can be
 * applied optimistically without a network round-trip.
 *
 * Algorithm reference: SuperMemo-2
 * - quality 0-5: 0=complete blackout, 5=perfect response
 * - ef (Easiness Factor): starts at 2.5, min 1.3
 * - interval: days until next review
 */

export interface CardState {
  ef: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string; // ISO 8601
}

export const INITIAL_CARD_STATE: Omit<CardState, 'nextReviewDate'> = {
  ef: 2.5,
  interval: 0,
  repetitions: 0,
};

/**
 * Calculate next review state from current state and quality response.
 * Returns the new state — does NOT mutate the input.
 */
export function calculateNextReview(card: CardState, quality: number): CardState {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error(`quality must be an integer 0–5, got: ${quality}`);
  }

  let { ef, interval, repetitions } = card;

  if (quality < 3) {
    // Lapse: reset to start
    repetitions = 0;
    interval = 1;
  } else {
    // Update EF (Easiness Factor)
    ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Compute interval
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * ef);

    repetitions += 1;
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    ef: Math.round(ef * 100) / 100, // round to 2dp to match backend
    interval,
    repetitions,
    nextReviewDate: nextReviewDate.toISOString(),
  };
}

/** Returns true if a card is due for review today */
export function isDue(card: CardState): boolean {
  return new Date(card.nextReviewDate) <= new Date();
}
