import type { Weekday3 } from './time';

/** Session names mirror the 8-week plan. */
export const SESSIONS: Record<string, string> = {
  tue: 'Push + Legs + Abs',
  thu: 'Pull + Push + Abs',
  fri: 'Short Pull + Core (bar day)',
  sat: 'Push + Legs + Abs'
};

export function isTrainingDay(weekday: Weekday3, trainingDays: string[]): boolean {
  return trainingDays.includes(weekday);
}

export function sessionFor(weekday: Weekday3, trainingDays: string[]): string | null {
  if (!trainingDays.includes(weekday)) return null;
  return SESSIONS[weekday] ?? 'Workout';
}

/** 1-based plan week for message flavour; null before the plan starts. */
export function weekNumber(dateStr: string, planStart: string): number | null {
  const start = new Date(planStart + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(d.getTime()) || d < start) return null;
  return Math.floor((d.getTime() - start.getTime()) / (7 * 86400000)) + 1;
}
