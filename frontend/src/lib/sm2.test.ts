import { describe, it, expect } from 'vitest';
import { calculateNextReview, isDue, INITIAL_CARD_STATE } from './sm2';

const baseCard = {
  ...INITIAL_CARD_STATE,
  nextReviewDate: new Date(Date.now() - 1000).toISOString(), // 1s ago = due
};

describe('SM-2 Algorithm', () => {
  it('resets interval on quality < 3 (Again)', () => {
    const result = calculateNextReview({ ...baseCard, repetitions: 5, interval: 21, ef: 2.5 }, 1);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.ef).toBeGreaterThanOrEqual(1.3);
  });

  it('first repetition gives interval=1', () => {
    const result = calculateNextReview({ ...baseCard, repetitions: 0, interval: 0, ef: 2.5 }, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('second repetition gives interval=6', () => {
    const result = calculateNextReview({ ...baseCard, repetitions: 1, interval: 1, ef: 2.5 }, 4);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it('subsequent intervals multiply by EF', () => {
    const result = calculateNextReview({ ...baseCard, repetitions: 2, interval: 6, ef: 2.5 }, 4);
    expect(result.interval).toBe(Math.round(6 * result.ef));
  });

  it('EF never drops below 1.3', () => {
    let card = { ...baseCard, repetitions: 3, interval: 10, ef: 1.35 };
    for (let i = 0; i < 10; i++) {
      card = { ...card, ...calculateNextReview(card, 0) };
    }
    expect(card.ef).toBeGreaterThanOrEqual(1.3);
  });

  it('throws on invalid quality', () => {
    expect(() => calculateNextReview(baseCard, 6)).toThrow();
    expect(() => calculateNextReview(baseCard, -1)).toThrow();
  });

  it('isDue returns true for overdue card', () => {
    expect(isDue({ ...baseCard, nextReviewDate: new Date(Date.now() - 86400000).toISOString() })).toBe(true);
  });

  it('isDue returns false for future card', () => {
    expect(isDue({ ...baseCard, nextReviewDate: new Date(Date.now() + 86400000).toISOString() })).toBe(false);
  });

  it('nextReviewDate is a valid ISO string in the future', () => {
    const result = calculateNextReview(baseCard, 4);
    const d = new Date(result.nextReviewDate);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });
});
