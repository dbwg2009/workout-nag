import { planForWeek } from '../data/plan';
import {
  TIMED_PLAN_EXERCISES,
  MICRO_EXERCISES,
  REST_SECONDS,
  type TimedPlanExercise,
  type MicroExercise
} from '../data/timerData';

export type TimerSource = 'today' | 'micro' | 'upcoming' | 'manual';

export type TimerLookup =
  | { found: true; name: string; seconds: number; source: TimerSource; upcomingDay?: string }
  | { found: false; name: string };

const TRAINING_DAYS = ['tue', 'thu', 'fri', 'sat'];

function matchPlanExercise(input: string): TimedPlanExercise | null {
  const lower = input.toLowerCase();
  for (const ex of TIMED_PLAN_EXERCISES) {
    if (ex.aliases.some((a) => lower === a || lower.includes(a) || a.includes(lower))) return ex;
  }
  return null;
}

function matchMicroExercise(input: string): MicroExercise | null {
  const lower = input.toLowerCase();
  for (const ex of MICRO_EXERCISES) {
    if (ex.aliases.some((a) => lower === a || lower.includes(a) || a.includes(lower))) return ex;
  }
  return null;
}

function nearestUpcoming(
  ex: TimedPlanExercise,
  weekday: string,
  phase: number
): { seconds: number; day: string } | null {
  // Search the next 7 days' worth of training days starting after today
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const startIdx = order.indexOf(weekday);
  for (let i = 1; i <= 7; i++) {
    const day = order[(startIdx + i) % 7];
    if (!TRAINING_DAYS.includes(day)) continue;
    const seconds = ex.planDurations[phase]?.[day];
    if (seconds) return { seconds, day };
  }
  // Try other phases if current phase has no match
  for (let p = 1; p <= 4; p++) {
    for (const day of TRAINING_DAYS) {
      const seconds = ex.planDurations[p]?.[day];
      if (seconds) return { seconds, day };
    }
  }
  return null;
}

export function lookupTimer(
  input: string,
  weekday: string,
  week: number | null,
  overrideSeconds?: number
): TimerLookup {
  const lower = input.toLowerCase().trim();
  const phase = planForWeek(week).phase;

  // Raw number input
  const rawNum = Number(lower);
  if (!isNaN(rawNum) && rawNum > 0) {
    return { found: true, name: `${rawNum}s timer`, seconds: rawNum, source: 'manual' };
  }

  // Rest
  if (lower === 'rest' || lower === 'r') {
    const s = overrideSeconds ?? REST_SECONDS;
    return { found: true, name: 'Rest', seconds: s, source: 'manual' };
  }

  const planEx = matchPlanExercise(lower);
  const microEx = matchMicroExercise(lower);

  // 1. Today's training session
  if (planEx && TRAINING_DAYS.includes(weekday)) {
    const s = overrideSeconds ?? planEx.planDurations[phase]?.[weekday];
    if (s) return { found: true, name: planEx.name, seconds: s, source: 'today' };
  }

  // 2. Micro exercises (fixed, not week-dependent)
  if (microEx) {
    const s = overrideSeconds ?? microEx.seconds;
    return { found: true, name: microEx.name, seconds: s, source: 'micro' };
  }

  // 3. Nearest upcoming session that includes this exercise
  if (planEx) {
    const upcoming = nearestUpcoming(planEx, weekday, phase);
    if (upcoming) {
      const s = overrideSeconds ?? upcoming.seconds;
      return { found: true, name: planEx.name, seconds: s, source: 'upcoming', upcomingDay: upcoming.day };
    }
  }

  // 4. Unknown — ask user to specify
  return { found: false, name: input };
}

export function shouldPush(enabled: boolean): boolean {
  return enabled && Math.random() < 0.2;
}

export function pushSeconds(maxPush: number): number {
  return Math.max(1, Math.floor(Math.random() * maxPush) + 1);
}
