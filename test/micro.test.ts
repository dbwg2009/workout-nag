import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideMicro } from '../src/core/escalation';

const S = { wakeStart: '09:00', wakeEnd: '21:00', maxNagsPerDay: 6 };
const fresh = { microDone: false, microNagCount: 0, microLastNagAt: null };
const now = new Date('2026-06-01T15:37:00Z'); // 16:37 BST, fraction ~0.63

function micro(overrides: object) {
  return decideMicro({ isTrainingDay: false, withinWake: true, fraction: 0.63, overrideActive: false, day: fresh, settings: S, now, ...overrides });
}

test('micro nags on rest day with fresh state', () => {
  assert.equal(micro({}).action, 'nag');
});

test('micro silent outside wake hours', () => {
  assert.equal(micro({ withinWake: false }).action, 'silent');
});

test('micro silent on training day', () => {
  assert.equal(micro({ isTrainingDay: true }).action, 'silent');
});

test('micro silent when override active', () => {
  const r = micro({ overrideActive: true });
  assert.equal(r.action, 'silent');
  assert.equal(r.reason, 'override active');
});

test('micro silent when already done', () => {
  assert.equal(micro({ day: { microDone: true, microNagCount: 1, microLastNagAt: now } }).action, 'silent');
});

test('micro silent when cap reached', () => {
  assert.equal(micro({ day: { microDone: false, microNagCount: 6, microLastNagAt: null } }).action, 'silent');
});

test('micro silent within gap after last nag', () => {
  const recentNag = new Date(now.getTime() - 60 * 60 * 1000); // 1hr ago, gap=150min at level 1
  assert.equal(micro({ day: { microDone: false, microNagCount: 1, microLastNagAt: recentNag } }).action, 'silent');
});

test('micro nags when gap has expired', () => {
  const oldNag = new Date(now.getTime() - 160 * 60 * 1000); // 160min ago, gap=150min
  assert.equal(micro({ day: { microDone: false, microNagCount: 1, microLastNagAt: oldNag } }).action, 'nag');
});
