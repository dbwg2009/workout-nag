import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashBuffer, verifyProof } from '../src/core/proof';

const FIX = join(import.meta.dirname ?? __dirname, 'fixtures');
const now = new Date();

test('hashBuffer is deterministic', () => {
  const a = hashBuffer(Buffer.from('hello'));
  const b = hashBuffer(Buffer.from('hello'));
  assert.equal(a, b);
  assert.notEqual(a, hashBuffer(Buffer.from('world')));
});

test('rejects a duplicate by hash', async () => {
  const buf = Buffer.from('some-image-bytes-xyz');
  const known = new Set([hashBuffer(buf)]);
  const r = await verifyProof({ buffer: buf, knownHashes: known, now });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'duplicate');
});

test('accepts non-EXIF bytes as a tracker screenshot', async () => {
  const buf = Buffer.from('not-a-real-jpeg-but-unique-' + Date.now());
  const r = await verifyProof({ buffer: buf, knownHashes: new Set(), now });
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'tracker');
  assert.equal(r.reason, 'accepted-no-exif');
});

test('accepts a fresh EXIF photo', async () => {
  const f = join(FIX, 'fresh.jpg');
  if (!existsSync(f)) {
    console.warn('fresh.jpg fixture missing — skipping');
    return;
  }
  const buf = readFileSync(f);
  const r = await verifyProof({ buffer: buf, knownHashes: new Set(), now });
  assert.equal(r.kind, 'photo');
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'fresh-photo');
});

test('rejects a stale EXIF photo', async () => {
  const f = join(FIX, 'stale.jpg');
  if (!existsSync(f)) {
    console.warn('stale.jpg fixture missing — skipping');
    return;
  }
  const buf = readFileSync(f);
  const r = await verifyProof({ buffer: buf, knownHashes: new Set(), now });
  assert.equal(r.kind, 'photo');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'stale-exif');
});
