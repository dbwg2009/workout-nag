import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrainingDay, sessionFor, weekNumber } from '../src/core/schedule';

const TD = ['tue', 'thu', 'fri', 'sat'];

test('isTrainingDay', () => {
  assert.equal(isTrainingDay('tue', TD), true);
  assert.equal(isTrainingDay('mon', TD), false);
  assert.equal(isTrainingDay('sun', TD), false);
});

test('sessionFor', () => {
  assert.equal(sessionFor('tue', TD), 'Push + Legs + Abs');
  assert.equal(sessionFor('fri', TD), 'Short Pull + Core (bar day)');
  assert.equal(sessionFor('mon', TD), null);
});

test('weekNumber', () => {
  assert.equal(weekNumber('2026-06-02', '2026-06-02'), 1);
  assert.equal(weekNumber('2026-06-08', '2026-06-02'), 1);
  assert.equal(weekNumber('2026-06-09', '2026-06-02'), 2);
  assert.equal(weekNumber('2026-05-30', '2026-06-02'), null); // before start
});
