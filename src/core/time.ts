import { DateTime } from 'luxon';

// luxon weekday: 1 = Monday ... 7 = Sunday
export const WEEKDAY3 = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday3 = (typeof WEEKDAY3)[number];

export interface LocalNow {
  dateStr: string; // yyyy-LL-dd in tz
  weekday: Weekday3;
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
  dt: DateTime;
}

export function localNow(tz: string, at?: Date): LocalNow {
  const dt = (at ? DateTime.fromJSDate(at) : DateTime.now()).setZone(tz);
  return {
    dateStr: dt.toFormat('yyyy-LL-dd'),
    weekday: WEEKDAY3[dt.weekday - 1],
    hour: dt.hour,
    minute: dt.minute,
    minutesSinceMidnight: dt.hour * 60 + dt.minute,
    dt
  };
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Fraction (0..1) through the waking window. */
export function wakeFraction(minutesNow: number, wakeStart: string, wakeEnd: string): number {
  const s = parseHm(wakeStart);
  const e = parseHm(wakeEnd);
  if (e <= s) return 0;
  return Math.min(1, Math.max(0, (minutesNow - s) / (e - s)));
}

export function isWithinWake(minutesNow: number, wakeStart: string, wakeEnd: string): boolean {
  const s = parseHm(wakeStart);
  const e = parseHm(wakeEnd);
  return minutesNow >= s && minutesNow < e;
}

/** Format a timestamp as "Monday 2 Jun 2026, 19:32 BST — Week 3 of 8" */
export function formatDateTime(tz: string, now: Date, week: number | null): string {
  const dt = DateTime.fromJSDate(now).setZone(tz).setLocale('en-GB');
  const weekPart = week ? `Week ${week} of 8` : 'plan not started';
  return `${dt.toFormat('cccc d MMM yyyy, HH:mm ZZZZ')} — ${weekPart}`;
}
