import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, escalationLevel, type DecideInput } from '../src/core/escalation';

const baseSettings = { wakeStart: '09:00', wakeEnd: '21:00', maxNagsPerDay: 6 };
const now = new Date('2026-06-02T12:00:00Z');

function input(overrides: Partial<DecideInput>): DecideInput {
  return {
    isTrainingDay: true,
    withinWake: true,
    fraction: 0.5,
    overrideActive: false,
    day: { status: 'pending', nagCount: 0, lastNagAt: null },
    settings: baseSettings,
    now,
    ...overrides
  };
}

test('escalationLevel boundaries', () => {
  assert.equal(escalationLevel(0), 0);
  assert.equal(escalationLevel(0.32), 0);
  assert.equal(escalationLevel(0.33), 1);
  assert.equal(escalationLevel(0.59), 1);
  assert.equal(escalationLevel(0.6), 2);
  assert.equal(escalationLevel(0.84), 2);
  assert.equal(escalationLevel(0.85), 3);
  assert.equal(escalationLevel(1), 3);
});

test('silent outside waking hours', () => {
  assert.equal(decide(input({ withinWake: false })).action, 'silent');
});

test('silent on non-training day', () => {
  assert.equal(decide(input({ isTrainingDay: false })).action, 'silent');
});

test('silent when already proven', () => {
  assert.equal(decide(input({ day: { status: 'proven', nagCount: 0, lastNagAt: null } })).action, 'silent');
});

test('silent on rest day status', () => {
  assert.equal(decide(input({ day: { status: 'rest', nagCount: 0, lastNagAt: null } })).action, 'silent');
});

test('silent when override active', () => {
  const d = decide(input({ overrideActive: true }));
  assert.equal(d.action, 'silent');
  assert.match(d.reason, /override/);
});

test('silent at nag cap', () => {
  assert.equal(decide(input({ day: { status: 'pending', nagCount: 6, lastNagAt: null } })).action, 'silent');
});

test('silent within min gap since last nag', () => {
  const recent = new Date(now.getTime() - 10 * 60000); // 10 min ago
  assert.equal(decide(input({ day: { status: 'pending', nagCount: 1, lastNagAt: recent } })).action, 'silent');
});

test('nags on a training day when due', () => {
  const d = decide(input({ fraction: 0.5 }));
  assert.equal(d.action, 'nag');
  assert.equal(d.escalation, 1);
});

test('nags again once min gap elapsed', () => {
  const old = new Date(now.getTime() - 200 * 60000); // 200 min ago
  const d = decide(input({ fraction: 0.7, day: { status: 'pending', nagCount: 2, lastNagAt: old } }));
  assert.equal(d.action, 'nag');
  assert.equal(d.escalation, 2);
});
