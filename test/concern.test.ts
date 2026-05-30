import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectsConcern } from '../src/core/concern';

test('detects illness / injury / exhaustion / exams', () => {
  assert.equal(detectsConcern("I'm ill today"), true);
  assert.equal(detectsConcern('I think I pulled my shoulder'), true);
  assert.equal(detectsConcern('feeling really rough'), true);
  assert.equal(detectsConcern("I'm exhausted and have no energy"), true);
  assert.equal(detectsConcern('I have an exam tomorrow'), true);
  assert.equal(detectsConcern("can't face it today"), true);
  assert.equal(detectsConcern('so tired'), true);
});

test('does not fire on normal messages', () => {
  assert.equal(detectsConcern('just finished, sending photo now'), false);
  assert.equal(detectsConcern('what time is it'), false);
  assert.equal(detectsConcern('on my way to the gym'), false);
});
