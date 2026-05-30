import { and, eq, lt, desc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { getDb } from '../src/db/client';
import { days, overrides, nudges, proofs, settings, type Day } from '../src/db/schema';

const db = getDb();

export async function ensureSettings() {
  const rows = await db.select().from(settings);
  if (rows.length === 0) {
    await db.insert(settings).values({ id: 1 });
  }
}

export async function ensureToday(
  dateStr: string,
  isTrainingDay: boolean,
  sessionName: string | null
): Promise<Day> {
  await db
    .insert(days)
    .values({ date: dateStr, isTrainingDay, sessionName })
    .onConflictDoNothing({ target: days.date });

  const [row] = await db.select().from(days).where(eq(days.date, dateStr));
  if (row.isTrainingDay !== isTrainingDay || row.sessionName !== sessionName) {
    await db
      .update(days)
      .set({ isTrainingDay, sessionName })
      .where(eq(days.id, row.id));
    row.isTrainingDay = isTrainingDay;
    row.sessionName = sessionName;
  }
  return row;
}

export async function markProven(dayId: number): Promise<void> {
  await db
    .update(days)
    .set({ status: 'proven', provenAt: new Date() })
    .where(eq(days.id, dayId));
}

export async function setDayStatus(dayId: number, status: Day['status']): Promise<void> {
  await db.update(days).set({ status }).where(eq(days.id, dayId));
}

export async function recordNag(
  dayId: number,
  escalation: number,
  message: string
): Promise<void> {
  await db.insert(nudges).values({ dayId, escalation, message });
  const [row] = await db.select().from(days).where(eq(days.id, dayId));
  await db
    .update(days)
    .set({ nagCount: row.nagCount + 1, escalation, lastNagAt: new Date() })
    .where(eq(days.id, dayId));
}

export async function addOverride(
  kind: 'rest' | 'sick' | 'exam' | 'snooze',
  startsAt: Date,
  endsAt: Date,
  reason?: string
): Promise<void> {
  await db.insert(overrides).values({ kind, startsAt, endsAt, reason });
}

export async function getActiveOverrides(now: Date) {
  const all = await db.select().from(overrides);
  return all.filter((o) => now >= o.startsAt && now < o.endsAt);
}

export async function getAllOverrides() {
  return db.select().from(overrides);
}

export async function getKnownHashes(): Promise<Set<string>> {
  const rows = await db.select({ hash: proofs.hash }).from(proofs);
  return new Set(rows.map((r) => r.hash));
}

export async function recordProof(
  dayId: number,
  kind: 'photo' | 'tracker',
  hash: string,
  exifTakenAt: Date | null
): Promise<void> {
  await db.insert(proofs).values({ dayId, kind, hash, exifTakenAt });
}

export async function getRecentDays(limit = 60): Promise<Day[]> {
  return db.select().from(days).orderBy(desc(days.date)).limit(limit);
}

export async function getSettingsRow() {
  const [row] = await db.select().from(settings);
  return row;
}

/**
 * Finalise past training days: mark 'missed' unless an override covered that
 * local day, in which case mark 'overridden'. Keeps streaks honest.
 */
export async function finalizePastDays(todayStr: string, tz: string): Promise<void> {
  const pending = await db
    .select()
    .from(days)
    .where(and(eq(days.status, 'pending'), eq(days.isTrainingDay, true), lt(days.date, todayStr)));
  if (pending.length === 0) return;
  const allOverrides = await db.select().from(overrides);

  for (const d of pending) {
    const dayStart = DateTime.fromISO(d.date, { zone: tz }).startOf('day');
    const dayEnd = dayStart.endOf('day');
    const covered = allOverrides.some(
      (o) => o.startsAt < dayEnd.toJSDate() && o.endsAt > dayStart.toJSDate()
    );
    await db
      .update(days)
      .set({ status: covered ? 'overridden' : 'missed' })
      .where(eq(days.id, d.id));
  }
}
