'use strict';

const { calculateNextReview, initialCardState, MIN_EF, INITIAL_EF } = require('../services/sm2Service');

function freshCard() {
  return { ef: INITIAL_EF, interval: 1, repetitions: 0 };
}

describe('SM-2 Algorithm — calculateNextReview', () => {

  // ── EF boundary ──────────────────────────────────────────────────────────
  test('EF never drops below 1.3 even on quality=0', () => {
    // Drive EF down with repeated quality=0 reviews
    let card = freshCard();
    for (let i = 0; i < 10; i++) {
      const result = calculateNextReview(card, 0);
      card = result;
    }
    expect(card.ef).toBeGreaterThanOrEqual(MIN_EF);
  });

  test('EF increases on quality=5 review', () => {
    const card = freshCard();
    const result = calculateNextReview(card, 5);
    expect(result.ef).toBeGreaterThan(INITIAL_EF);
  });

  test('EF stays same on quality=4 (approx — within 0.01)', () => {
    // q=4: delta = 0.1 - (5-4)*(0.08 + (5-4)*0.02) = 0.1 - 0.10 = 0
    const card = freshCard();
    const result = calculateNextReview(card, 4);
    expect(result.ef).toBeCloseTo(INITIAL_EF, 1);
  });

  // ── Interval progression ─────────────────────────────────────────────────
  test('First successful review → interval=1', () => {
    const card = { ef: INITIAL_EF, interval: 1, repetitions: 0 };
    const result = calculateNextReview(card, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  test('Second successful review → interval=6', () => {
    const card = { ef: INITIAL_EF, interval: 1, repetitions: 1 };
    const result = calculateNextReview(card, 5);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  test('Third successful review → interval = round(6 * EF)', () => {
    const ef = INITIAL_EF; // 2.5
    const card = { ef, interval: 6, repetitions: 2 };
    const result = calculateNextReview(card, 5);
    // EF increases on q=5, so interval = round(6 * newEF)
    expect(result.interval).toBe(Math.round(6 * result.ef));
    expect(result.repetitions).toBe(3);
  });

  // ── Lapse (quality < 3) ──────────────────────────────────────────────────
  test('Quality < 3 (lapse) resets repetitions to 0 and interval to 1', () => {
    // Card that was on day 43 (third successful review)
    const card = { ef: 2.5, interval: 43, repetitions: 3 };
    const result = calculateNextReview(card, 2);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  test('Quality=0 (blackout) resets and lowers EF', () => {
    const card = { ef: 2.5, interval: 10, repetitions: 2 };
    const result = calculateNextReview(card, 0);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.ef).toBeLessThan(2.5);
  });

  // ── nextReviewDate ────────────────────────────────────────────────────────
  test('nextReviewDate is today + interval days (midnight)', () => {
    const card = freshCard();
    const result = calculateNextReview(card, 5);
    const expected = new Date();
    expected.setDate(expected.getDate() + result.interval);
    expected.setHours(0, 0, 0, 0);
    expect(result.nextReviewDate.toDateString()).toBe(expected.toDateString());
  });

  test('nextReviewDate on lapse is tomorrow (interval=1)', () => {
    const card = { ef: 2.5, interval: 20, repetitions: 5 };
    const result = calculateNextReview(card, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(result.nextReviewDate.toDateString()).toBe(tomorrow.toDateString());
  });

  // ── Input validation ──────────────────────────────────────────────────────
  test('throws if quality is out of range', () => {
    const card = freshCard();
    expect(() => calculateNextReview(card, 6)).toThrow();
    expect(() => calculateNextReview(card, -1)).toThrow();
  });

  test('throws if quality is not an integer', () => {
    const card = freshCard();
    expect(() => calculateNextReview(card, 2.5)).toThrow();
  });

  // ── Cumulative sequence test ──────────────────────────────────────────────
  test('full 5-review sequence produces increasing intervals', () => {
    const qualities = [5, 5, 5, 5, 5];
    let card = { ef: INITIAL_EF, interval: 1, repetitions: 0 };
    const intervals = [];

    for (const q of qualities) {
      card = calculateNextReview(card, q);
      intervals.push(card.interval);
    }

    // Each interval should be >= the previous one
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });
});
