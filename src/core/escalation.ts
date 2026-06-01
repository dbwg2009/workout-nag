export type DecisionAction = 'silent' | 'nag';

export interface DayState {
  status: string;
  nagCount: number;
  lastNagAt: Date | null;
}

export interface EscalationSettings {
  wakeStart: string;
  wakeEnd: string;
  maxNagsPerDay: number;
}

export interface Decision {
  action: DecisionAction;
  escalation?: number;
  reason: string;
}

/** Minimum minutes between nags, by escalation level (gets shorter later in the day). */
export const MIN_GAP_MIN = [150, 150, 90, 45];

export function escalationLevel(fraction: number): number {
  if (fraction < 0.33) return 0;
  if (fraction < 0.6) return 1;
  if (fraction < 0.85) return 2;
  return 3;
}

export interface DecideInput {
  isTrainingDay: boolean;
  withinWake: boolean;
  fraction: number;
  overrideActive: boolean;
  day: DayState;
  settings: EscalationSettings;
  now: Date;
}

export interface MicroDayState {
  microDone: boolean;
  microNagCount: number;
  microLastNagAt: Date | null;
}

export interface MicroDecideInput {
  isTrainingDay: boolean; // micro morning is skipped on training days
  withinWake: boolean;
  fraction: number;
  overrideActive: boolean;
  day: MicroDayState;
  settings: EscalationSettings;
  now: Date;
}

/** Same gap/cap/escalation logic as decide(), but for the daily micro routine. */
export function decideMicro(input: MicroDecideInput): Decision {
  const { isTrainingDay, withinWake, overrideActive, fraction, day, settings, now } = input;
  if (!withinWake) return { action: 'silent', reason: 'outside waking hours' };
  if (isTrainingDay) return { action: 'silent', reason: 'training day — session covers micro' };
  if (day.microDone) return { action: 'silent', reason: 'micro routine already done today' };
  if (overrideActive) return { action: 'silent', reason: 'override active' };
  if (day.microNagCount >= settings.maxNagsPerDay) {
    return { action: 'silent', reason: 'micro nag cap reached' };
  }
  const level = escalationLevel(fraction);
  if (day.microLastNagAt) {
    const gapMin = (now.getTime() - day.microLastNagAt.getTime()) / 60000;
    if (gapMin < MIN_GAP_MIN[level]) {
      return { action: 'silent', reason: 'within minimum gap since last micro nag' };
    }
  }
  return { action: 'nag', escalation: level, reason: 'micro routine not yet done' };
}

/**
 * The single source of truth for "should I nag right now, and how hard".
 * Pure function — no DB, no Discord, fully unit-testable.
 */
export function decide(input: DecideInput): Decision {
  const { isTrainingDay, withinWake, fraction, overrideActive, day, settings, now } = input;

  if (!withinWake) return { action: 'silent', reason: 'outside waking hours' };
  if (!isTrainingDay) return { action: 'silent', reason: 'not a training day' };
  if (day.status === 'proven') return { action: 'silent', reason: 'already proven today' };
  if (day.status === 'rest') return { action: 'silent', reason: 'rest day' };
  if (overrideActive) return { action: 'silent', reason: 'override active (rest/sick/exam/snooze)' };
  if (day.nagCount >= settings.maxNagsPerDay) {
    return { action: 'silent', reason: 'daily nag cap reached' };
  }

  const level = escalationLevel(fraction);
  if (day.lastNagAt) {
    const gapMin = (now.getTime() - day.lastNagAt.getTime()) / 60000;
    if (gapMin < MIN_GAP_MIN[level]) {
      return { action: 'silent', reason: 'within minimum gap since last nag' };
    }
  }
  return { action: 'nag', escalation: level, reason: 'training day not yet proven' };
}
