import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCommand,
  isOverrideActive,
  overrideWindow,
  type WindowCommand
} from '../src/core/overrides';

test('parseCommand keywords', () => {
  assert.deepEqual(parseCommand('/rest'), { type: 'rest' });
  assert.deepEqual(parseCommand('/REST please'), { type: 'rest' });
  assert.deepEqual(parseCommand('/status'), { type: 'status' });
  assert.deepEqual(parseCommand('/sick'), { type: 'sick', days: 2 });
  assert.deepEqual(parseCommand('/sick 3'), { type: 'sick', days: 3 });
  assert.deepEqual(parseCommand('/ill 5'), { type: 'sick', days: 5 });
  assert.deepEqual(parseCommand('/snooze'), { type: 'snooze', hours: 2 });
  assert.deepEqual(parseCommand('/snooze 4'), { type: 'snooze', hours: 4 });
  assert.deepEqual(parseCommand('/exam'), { type: 'exam', until: null });
  assert.deepEqual(parseCommand('/exam 2026-07-01'), { type: 'exam', until: '2026-07-01' });
  assert.deepEqual(parseCommand('/done'), { type: 'done' });
  assert.equal(parseCommand('what is up'), null);
  assert.equal(parseCommand('rest'), null);
  assert.equal(parseCommand(''), null);
});

test('sick days clamp', () => {
  assert.deepEqual(parseCommand('/sick 99'), { type: 'sick', days: 14 });
});

test('isOverrideActive', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const rows = [
    { kind: 'snooze', startsAt: new Date('2026-06-02T11:00:00Z'), endsAt: new Date('2026-06-02T13:00:00Z') }
  ];
  assert.equal(isOverrideActive(rows, now), true);
  assert.equal(isOverrideActive(rows, new Date('2026-06-02T14:00:00Z')), false);
});

test('overrideWindow snooze adds hours', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const w = overrideWindow({ type: 'snooze', hours: 3 } as WindowCommand, 'Europe/London', now);
  const diffH = (w.endsAt.getTime() - w.startsAt.getTime()) / 3600000;
  assert.ok(Math.abs(diffH - 3) < 0.01);
});

test('overrideWindow sick adds days', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const w = overrideWindow({ type: 'sick', days: 2 } as WindowCommand, 'Europe/London', now);
  const diffD = (w.endsAt.getTime() - w.startsAt.getTime()) / 86400000;
  assert.ok(Math.abs(diffD - 2) < 0.01);
});

test('overrideWindow rest ends same day after now', () => {
  const now = new Date('2026-06-02T12:00:00Z');
  const w = overrideWindow({ type: 'rest' } as WindowCommand, 'Europe/London', now);
  assert.ok(w.endsAt.getTime() > w.startsAt.getTime());
});
