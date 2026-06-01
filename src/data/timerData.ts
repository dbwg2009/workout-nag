// Timed exercise durations in seconds.
// planDurations: phase (1–4) -> weekday -> seconds.
// Only entries that actually appear in the plan are listed.

export interface TimedPlanExercise {
  name: string;
  aliases: string[];
  planDurations: Partial<Record<number, Partial<Record<string, number>>>>;
}

export interface MicroExercise {
  name: string;
  aliases: string[];
  seconds: number;
  session: 'morning' | 'evening' | 'both';
}

export const TIMED_PLAN_EXERCISES: TimedPlanExercise[] = [
  {
    name: 'Plank',
    aliases: ['plank'],
    planDurations: {
      1: { tue: 30, thu: 30, sat: 35 },
      2: { tue: 40, thu: 45 },
      3: { tue: 50, thu: 50 },
      4: { tue: 60, sat: 75 }
    }
  },
  {
    name: 'Dead hang',
    aliases: ['dead hang', 'hang', 'dead-hang'],
    planDurations: {
      1: { thu: 20, fri: 25 },
      2: { fri: 30 },
      3: { fri: 35 },
      4: { fri: 40 }
    }
  },
  {
    name: 'Hollow body hold',
    aliases: ['hollow body', 'hollow body hold', 'hollow'],
    planDurations: {
      1: { thu: 15 },
      2: { sat: 25 },
      3: { sat: 30 },
      4: { thu: 35, sat: 40 }
    }
  }
];

export const MICRO_EXERCISES: MicroExercise[] = [
  // Morning
  { name: 'Arm circles', aliases: ['arm circles', 'arm circle'], seconds: 30, session: 'morning' },
  { name: 'Slow press-ups', aliases: ['slow press-ups', 'slow press ups', 'micro press-ups', 'micro press ups'], seconds: 60, session: 'morning' },
  { name: 'Plank hold (micro)', aliases: ['micro plank', 'morning plank'], seconds: 30, session: 'morning' },
  { name: 'Bodyweight squats (micro)', aliases: ['micro squats', 'morning squats'], seconds: 60, session: 'morning' },
  { name: 'Chest doorframe stretch', aliases: ['chest stretch', 'doorframe stretch', 'chest doorframe', 'chest door'], seconds: 30, session: 'both' },
  // Evening
  { name: 'Lat stretch', aliases: ['lat stretch', 'lat'], seconds: 30, session: 'evening' },
  { name: 'Hollow body hold (micro)', aliases: ['evening hollow', 'micro hollow', 'hollow micro'], seconds: 20, session: 'evening' },
  { name: 'Hip flexor stretch', aliases: ['hip flexor', 'hip stretch', 'lunge stretch', 'hip'], seconds: 30, session: 'evening' },
  { name: 'Breathing', aliases: ['breathing', 'deep breathing', 'slow breathing', 'breath'], seconds: 60, session: 'evening' }
];

export const REST_SECONDS = 75;
