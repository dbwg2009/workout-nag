import exifr from 'exifr';
import { createHash } from 'node:crypto';

export function hashBuffer(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

export async function readExifDate(buf: Buffer | Uint8Array): Promise<Date | null> {
  try {
    const out = await exifr.parse(buf, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
    });
    const d = out?.DateTimeOriginal || out?.CreateDate || out?.ModifyDate;
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

export interface ProofResult {
  ok: boolean;
  reason: 'fresh-photo' | 'accepted-no-exif' | 'duplicate' | 'stale-exif' | 'future-exif';
  hash: string;
  exifTakenAt: Date | null;
  kind: 'photo' | 'tracker';
}

export interface VerifyInput {
  buffer: Buffer | Uint8Array;
  knownHashes: Set<string>;
  now: Date;
  freshnessHours?: number;
}

/**
 * Free proof verification: dedupe by content hash + EXIF freshness for photos.
 * Screenshots (no EXIF) are accepted but still deduped, so an old screenshot
 * can't be re-submitted.
 */
export async function verifyProof(input: VerifyInput): Promise<ProofResult> {
  const { buffer, knownHashes, now, freshnessHours = 36 } = input;
  const hash = hashBuffer(buffer);
  const exifTakenAt = await readExifDate(buffer);
  const kind: 'photo' | 'tracker' = exifTakenAt ? 'photo' : 'tracker';

  if (knownHashes.has(hash)) {
    return { ok: false, reason: 'duplicate', hash, exifTakenAt, kind };
  }
  if (exifTakenAt) {
    const ageHours = (now.getTime() - exifTakenAt.getTime()) / 3600000;
    if (ageHours > freshnessHours) {
      return { ok: false, reason: 'stale-exif', hash, exifTakenAt, kind };
    }
    if (ageHours < -2) {
      return { ok: false, reason: 'future-exif', hash, exifTakenAt, kind };
    }
  }
  return {
    ok: true,
    reason: exifTakenAt ? 'fresh-photo' : 'accepted-no-exif',
    hash,
    exifTakenAt,
    kind
  };
}
