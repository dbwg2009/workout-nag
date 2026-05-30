import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../src/core/streak';

test('counts consecutive proven training days', () => {
  const days = [
    { dateStr: '2026-06-06', isTrainingDay: true, status: 'proven' },
    { dateStr: '2026-06-04', isTrainingDay: true, status: 'proven' },
    { dateStr: '2026-06-02', isTrainingDay: true, status: 'proven' }
  ];
  assert.equal(computeStreak(days), 3);
});

test('rest days are skipped, not counted or breaking', () => {
  const days = [
    { dateStr: '2026-06-04', isTrainingDay: true, status: 'proven' },
    { dateStr: '2026-06-03', isTrainingDay: false, status: 'rest' },
    { dateStr: '2026-06-02', isTrainingDay: true, status: 'proven' }
  ];
  assert.equal(computeStreak(days), 2);
});

test('missed breaks the streak', () => {
  const days = [
    { dateStr: '2026-06-06', isTrainingDay: true, status: 'proven' },
    { dateStr: '2026-06-04', isTrainingDay: true, status: 'missed' },
    { dateStr: '2026-06-02', isTrainingDay: true, status: 'proven' }
  ];
  assert.equal(computeStreak(days), 1);
});

test('today pending does not break streak', () => {
  const days = [
    { dateStr: '2026-06-06', isTrainingDay: true, status: 'pending' },
    { dateStr: '2026-06-04', isTrainingDay: true, status: 'proven' },
    { dateStr: '2026-06-02', isTrainingDay: true, status: 'proven' }
  ];
  assert.equal(computeStreak(days), 2);
});
