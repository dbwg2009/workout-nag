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

// Fallback only — real training days come from config (cfg.trainingDays).
const DEFAULT_TRAINING_DAYS = ['tue', 'thu', 'fri', 'sat'];

// Bounds mirror the /timer slash command's `seconds` option (worker/index.ts).
export const MIN_TIMER_SECONDS = 5;
export const MAX_TIMER_SECONDS = 600;

function clampSeconds(s: number): number {
  return Math.max(MIN_TIMER_SECONDS, Math.min(MAX_TIMER_SECONDS, Math.round(s)));
}

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
  phase: number,
  trainingDays: string[]
): { seconds: number; day: string } | null {
  // Search the next 7 days for the soonest training day that includes this
  // exercise IN THE CURRENT PHASE. We deliberately do not fall back to other
  // phases — showing a phase-4 hold time during phase 1 would be misleading.
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const startIdx = order.indexOf(weekday);
  for (let i = 1; i <= 7; i++) {
    const day = order[(startIdx + i) % 7];
    if (!trainingDays.includes(day)) continue;
    const seconds = ex.planDurations[phase]?.[day];
    if (seconds) return { seconds, day };
  }
  return null;
}

export function lookupTimer(
  input: string,
  weekday: string,
  week: number | null,
  overrideSeconds?: number,
  trainingDays: string[] = DEFAULT_TRAINING_DAYS
): TimerLookup {
  const lower = input.toLowerCase().trim();
  const phase = planForWeek(week).phase;

  // Raw number input — clamp to the same bounds as the slash-command option.
  const rawNum = Number(lower);
  if (!isNaN(rawNum) && rawNum > 0) {
    const s = clampSeconds(rawNum);
    return { found: true, name: `${s}s timer`, seconds: s, source: 'manual' };
  }

  // Rest
  if (lower === 'rest' || lower === 'r') {
    const s = clampSeconds(overrideSeconds ?? REST_SECONDS);
    return { found: true, name: 'Rest', seconds: s, source: 'manual' };
  }

  const planEx = matchPlanExercise(lower);
  const microEx = matchMicroExercise(lower);

  // 1. Today's training session
  if (planEx && trainingDays.includes(weekday)) {
    const s = overrideSeconds ?? planEx.planDurations[phase]?.[weekday];
    if (s) return { found: true, name: planEx.name, seconds: clampSeconds(s), source: 'today' };
  }

  // 2. Micro exercises (fixed, not week-dependent)
  if (microEx) {
    const s = overrideSeconds ?? microEx.seconds;
    return { found: true, name: microEx.name, seconds: clampSeconds(s), source: 'micro' };
  }

  // 3. Nearest upcoming session that includes this exercise
  if (planEx) {
    const upcoming = nearestUpcoming(planEx, weekday, phase, trainingDays);
    if (upcoming) {
      const s = overrideSeconds ?? upcoming.seconds;
      return { found: true, name: planEx.name, seconds: clampSeconds(s), source: 'upcoming', upcomingDay: upcoming.day };
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
