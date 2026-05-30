import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHm, wakeFraction, isWithinWake, localNow } from '../src/core/time';

test('parseHm', () => {
  assert.equal(parseHm('09:00'), 540);
  assert.equal(parseHm('21:30'), 1290);
  assert.equal(parseHm('00:00'), 0);
});

test('wakeFraction clamps 0..1', () => {
  assert.equal(wakeFraction(540, '09:00', '21:00'), 0);
  assert.equal(wakeFraction(1260, '09:00', '21:00'), 1);
  assert.ok(Math.abs(wakeFraction(900, '09:00', '21:00') - 0.5) < 0.01);
  assert.equal(wakeFraction(60, '09:00', '21:00'), 0); // before window
  assert.equal(wakeFraction(1400, '09:00', '21:00'), 1); // after window
});

test('isWithinWake', () => {
  assert.equal(isWithinWake(540, '09:00', '21:00'), true);
  assert.equal(isWithinWake(539, '09:00', '21:00'), false);
  assert.equal(isWithinWake(1260, '09:00', '21:00'), false); // == end is out
  assert.equal(isWithinWake(1259, '09:00', '21:00'), true);
});

test('localNow respects timezone (BST)', () => {
  // 2026-06-02 is a Tuesday; London is BST (UTC+1) in June
  const ln = localNow('Europe/London', new Date('2026-06-02T10:30:00Z'));
  assert.equal(ln.weekday, 'tue');
  assert.equal(ln.hour, 11);
  assert.equal(ln.minute, 30);
  assert.equal(ln.dateStr, '2026-06-02');
});
