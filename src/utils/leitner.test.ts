import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTextDirection,
  processCardReview,
  getDueCards,
  calculateLeitnerStats,
  advanceSimulationClock,
  createInitialCards,
  DAY_MS,
} from './leitner.ts';

test('detectTextDirection accurately identifies LTR (English) and RTL (Persian/Farsi) text', () => {
  assert.equal(detectTextDirection('What is Spaced Repetition?'), 'ltr');
  assert.equal(detectTextDirection('حافظه بلندمدت و تکرار با فاصله'), 'rtl');
  assert.equal(detectTextDirection('   خردمند و دانش‌پژوه   '), 'rtl');
  assert.equal(detectTextDirection(''), 'ltr');
});

test('processCardReview promotes card by +1 box on pass and caps at Box 5', () => {
  const now = 1_700_000_000_000;
  const [baseCard] = createInitialCards(now);

  // Box 1 -> Box 2 (2 days interval)
  const promoted = processCardReview({ ...baseCard, box: 1 }, 'pass', now);
  assert.equal(promoted.box, 2);
  assert.equal(promoted.nextReviewAt, now + 2 * DAY_MS);
  assert.equal(promoted.passCount, baseCard.passCount + 1);
  assert.equal(promoted.streak, baseCard.streak + 1);

  // Box 5 -> stays Box 5 (16 days interval)
  const capped = processCardReview({ ...baseCard, box: 5 }, 'pass', now);
  assert.equal(capped.box, 5);
  assert.equal(capped.nextReviewAt, now + 16 * DAY_MS);
});

test('processCardReview resets card to Box 1 and streak 0 on fail', () => {
  const now = 1_700_000_000_000;
  const [baseCard] = createInitialCards(now);

  const failed = processCardReview({ ...baseCard, box: 4, streak: 5 }, 'fail', now);
  assert.equal(failed.box, 1);
  assert.equal(failed.streak, 0);
  assert.equal(failed.nextReviewAt, now);
  assert.equal(failed.failCount, baseCard.failCount + 1);
});

test('getDueCards orders lower boxes first and respects deck/box filters', () => {
  const now = 1_700_000_000_000;
  const cards = createInitialCards(now);
  const due = getDueCards(cards, now);

  assert.equal(due.length, 7);
  // First due card must be Box 1
  assert.equal(due[0].box, 1);
  // Filter by Box 2
  const box2Due = getDueCards(cards, now, 2);
  assert.equal(box2Due.length, 2);
  assert.ok(box2Due.every((c) => c.box === 2));
});

test('calculateLeitnerStats and advanceSimulationClock compute accurate metrics', () => {
  const now = 1_700_000_000_000;
  const cards = createInitialCards(now);
  const statsBefore = calculateLeitnerStats(cards, now);

  assert.equal(statsBefore.totalCards, 10);
  assert.equal(statsBefore.dueNowCount, 7);
  assert.equal(statsBefore.boxCounts[5], 2);

  // Advance clock by 12 days so all 10 cards become due
  const shifted = advanceSimulationClock(cards, 12);
  const statsAfter = calculateLeitnerStats(shifted, now);
  assert.equal(statsAfter.dueNowCount, 10);
});
