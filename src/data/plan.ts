// The full 8-week programme, mirroring the plan we built. Generic (no personal
// data) so it's safe to keep in the public repo.

export interface Exercise {
  name: string;
  sets: string;
}
export interface Session {
  day: 'tue' | 'thu' | 'fri' | 'sat';
  label: string;
  bar: boolean;
  note: string;
  exercises: Exercise[];
}
export interface Phase {
  phase: number;
  weeks: string;
  name: string;
  focus: string;
  sessions: Record<'tue' | 'thu' | 'fri' | 'sat', Session>;
}

export const WARMUP: string[] = [
  'Arm circles — forward & back (30s)',
  'Leg swings — front & side (30s each)',
  '10 slow bodyweight squats',
  '5 slow incline press-ups',
  'Shoulder rolls + wrist circles (30s)'
];

export const PRINCIPLES: string[] = [
  'Leave 1–2 reps in reserve on most sets; only the last set of an exercise goes close to true failure.',
  'Rest 60–90 seconds between sets.',
  'Progress weekly: add a rep per set, or an extra set, to something.',
  'You are lean and building muscle — eat enough (~120–130g protein/day). This is not a cut; do not restrict.',
  'Aim for 7.5h sleep; muscle is built during recovery, not in the session.',
  'Rest, illness, and exams take priority. Missing a session never undoes progress. Friday is the first to drop in exam crunch.'
];

export const PLAN: { startDate: string; trainingDays: string[]; restDays: string[]; phases: Phase[] } = {
  startDate: '2026-06-02',
  trainingDays: ['tue', 'thu', 'fri', 'sat'],
  restDays: ['mon', 'wed', 'sun'],
  phases: [
    {
      phase: 1,
      weeks: '1–2',
      name: 'Foundation',
      focus: 'Build the pressing habit, learn the movements, ease legs in.',
      sessions: {
        tue: {
          day: 'tue', label: 'Push + Legs + Abs', bar: false,
          note: 'No bar. Stop most sets 1–2 reps short; last set near failure.',
          exercises: [
            { name: 'Elevated press-ups (hands on step/chair)', sets: '3 × 10–12 (1–2 RIR)' },
            { name: 'Diamond press-ups (elevated)', sets: '3 × 6–8' },
            { name: 'Bodyweight squats', sets: '3 × 15' },
            { name: 'Reverse lunges', sets: '3 × 8 each leg' },
            { name: 'Glute bridges', sets: '3 × 12' },
            { name: 'Plank', sets: '3 × 30 sec' },
            { name: 'Leg raises', sets: '3 × 10' }
          ]
        },
        thu: {
          day: 'thu', label: 'Pull + Push + Abs', bar: true,
          note: 'Bar day — your most important session. Leave 1 in reserve on early pull sets.',
          exercises: [
            { name: 'Pull-ups', sets: '4 × 5–7 (1 RIR)' },
            { name: 'Dead hang', sets: '3 × 20 sec' },
            { name: 'Elevated press-ups', sets: '3 × 10–12' },
            { name: 'Diamond press-ups (elevated)', sets: '3 × 6–8' },
            { name: 'Hollow body hold', sets: '3 × 15 sec' },
            { name: 'Plank', sets: '3 × 30 sec' }
          ]
        },
        fri: {
          day: 'fri', label: 'Short Pull + Core', bar: true,
          note: 'Short bonus (~20 min) — the 2nd back dose. Drop this one first if exams are heavy.',
          exercises: [
            { name: 'Pull-ups', sets: '3 × 5 (controlled)' },
            { name: 'Chin-ups (palms facing you)', sets: '3 × max (1 RIR)' },
            { name: 'Dead hang', sets: '2 × 25 sec' },
            { name: 'Hanging knee raises', sets: '3 × 10' }
          ]
        },
        sat: {
          day: 'sat', label: 'Push + Legs + Abs', bar: false,
          note: 'Wide press-ups hit outer chest — your weakest area. Prioritise them.',
          exercises: [
            { name: 'Wide press-ups', sets: '3 × 8–10' },
            { name: 'Standard or elevated press-ups', sets: '3 × 10' },
            { name: 'Pike press-ups', sets: '3 × 8' },
            { name: 'Forward / walking lunges', sets: '3 × 10 each' },
            { name: 'Calf raises', sets: '3 × 20' },
            { name: 'Bicycle crunches', sets: '3 × 15 each' },
            { name: 'Plank', sets: '3 × 35 sec' }
          ]
        }
      }
    },
    {
      phase: 2,
      weeks: '3–4',
      name: 'Progression',
      focus: 'Drop to floor press-ups, add volume, deepen the legs.',
      sessions: {
        tue: {
          day: 'tue', label: 'Push + Legs + Abs', bar: false,
          note: 'Floor press-ups now (knees if needed). Add a set vs Phase 1.',
          exercises: [
            { name: 'Floor press-ups', sets: '4 × max' },
            { name: 'Wide press-ups', sets: '4 × max' },
            { name: 'Diamond press-ups', sets: '3 × 8–10' },
            { name: 'Bodyweight squats', sets: '4 × 18' },
            { name: 'Bulgarian split squats', sets: '3 × 8 each' },
            { name: 'Glute bridges', sets: '3 × 15' },
            { name: 'Plank', sets: '4 × 40 sec' },
            { name: 'Leg raises', sets: '4 × 12' }
          ]
        },
        thu: {
          day: 'thu', label: 'Pull + Push + Abs', bar: true,
          note: 'Add chin-ups — they hit biceps directly.',
          exercises: [
            { name: 'Pull-ups', sets: '4 × 7–9' },
            { name: 'Chin-ups', sets: '3 × max' },
            { name: 'Floor press-ups', sets: '3 × max' },
            { name: 'Diamond press-ups', sets: '3 × 8–10' },
            { name: 'Bicycle crunches', sets: '4 × 20 each' },
            { name: 'Plank', sets: '3 × 45 sec' }
          ]
        },
        fri: {
          day: 'fri', label: 'Short Pull + Core', bar: true,
          note: 'Short (~20 min). Negatives build the strength for more pull-ups.',
          exercises: [
            { name: 'Pull-ups', sets: '3 × 6' },
            { name: 'Chin-ups', sets: '3 × max' },
            { name: 'Negative pull-ups (5 sec lower)', sets: '2 × 4' },
            { name: 'Dead hang', sets: '2 × 30 sec' },
            { name: 'Hanging knee raises', sets: '3 × 12' }
          ]
        },
        sat: {
          day: 'sat', label: 'Push + Legs + Abs', bar: false,
          note: 'Introduce tricep dips for arm definition.',
          exercises: [
            { name: 'Wide press-ups', sets: '4 × max' },
            { name: 'Pike press-ups', sets: '4 × 10–12' },
            { name: 'Tricep dips (chair/step)', sets: '3 × 12' },
            { name: 'Reverse lunges', sets: '4 × 10 each' },
            { name: 'Single-leg glute bridge', sets: '3 × 8 each' },
            { name: 'Calf raises', sets: '3 × 25' },
            { name: 'Hollow body hold', sets: '3 × 25 sec' }
          ]
        }
      }
    },
    {
      phase: 3,
      weeks: '5–6',
      name: 'Intensity',
      focus: 'Full press-ups, tempo squats, push closer to failure.',
      sessions: {
        tue: {
          day: 'tue', label: 'Push + Legs + Abs', bar: false,
          note: 'Last 2 sets of each press near failure. Rest 90 sec.',
          exercises: [
            { name: 'Standard press-ups', sets: '4 × max' },
            { name: 'Wide press-ups', sets: '4 × max' },
            { name: 'Diamond press-ups', sets: '4 × max' },
            { name: 'Tricep dips', sets: '3 × 15' },
            { name: 'Tempo squats (3 sec down)', sets: '4 × 15' },
            { name: 'Bulgarian split squats', sets: '3 × 10 each' },
            { name: 'Plank', sets: '4 × 50 sec' },
            { name: 'Leg raises', sets: '4 × 15' }
          ]
        },
        thu: {
          day: 'thu', label: 'Pull + Push + Abs', bar: true,
          note: 'Pull-ups should feel easier now — push the reps up.',
          exercises: [
            { name: 'Pull-ups', sets: '5 × 8–10' },
            { name: 'Chin-ups', sets: '4 × max' },
            { name: 'Wide press-ups', sets: '3 × max' },
            { name: 'Diamond press-ups', sets: '3 × max' },
            { name: 'Bicycle crunches', sets: '4 × 25 each' },
            { name: 'Plank', sets: '4 × 50 sec' }
          ]
        },
        fri: {
          day: 'fri', label: 'Short Pull + Core', bar: true,
          note: 'Short (~20 min). Keep the back frequency high.',
          exercises: [
            { name: 'Pull-ups', sets: '4 × 7' },
            { name: 'Chin-ups', sets: '3 × max' },
            { name: 'Negative pull-ups (5 sec lower)', sets: '3 × 5' },
            { name: 'Dead hang', sets: '2 × 35 sec' },
            { name: 'Hanging leg raises', sets: '3 × 12' }
          ]
        },
        sat: {
          day: 'sat', label: 'Push + Legs + Abs', bar: false,
          note: 'Add jump squats for power. Highest push volume yet.',
          exercises: [
            { name: 'Wide press-ups', sets: '5 × max' },
            { name: 'Pike press-ups', sets: '4 × 12–15' },
            { name: 'Tricep dips', sets: '4 × 15' },
            { name: 'Jump squats', sets: '4 × 12' },
            { name: 'Walking lunges', sets: '4 × 12 each' },
            { name: 'Calf raises', sets: '4 × 25' },
            { name: 'Hollow body hold', sets: '4 × 30 sec' }
          ]
        }
      }
    },
    {
      phase: 4,
      weeks: '7–8',
      name: 'Peak',
      focus: 'Max volume, hardest variations, test your limits.',
      sessions: {
        tue: {
          day: 'tue', label: 'Push + Legs + Abs', bar: false,
          note: 'Peak volume. You should be unrecognisable from Week 1.',
          exercises: [
            { name: 'Standard press-ups', sets: '5 × max' },
            { name: 'Wide press-ups', sets: '5 × max' },
            { name: 'Diamond press-ups', sets: '4 × max' },
            { name: 'Tricep dips', sets: '4 × 18' },
            { name: 'Squats', sets: '5 × 20' },
            { name: 'Bulgarian split squats', sets: '4 × 12 each' },
            { name: 'Plank', sets: '4 × 60 sec' },
            { name: 'Leg raises', sets: '4 × 20' }
          ]
        },
        thu: {
          day: 'thu', label: 'Pull + Push + Abs', bar: true,
          note: 'Try archer press-ups — the step toward one-arm press-ups.',
          exercises: [
            { name: 'Pull-ups', sets: '5 × 10–13' },
            { name: 'Chin-ups', sets: '4 × max' },
            { name: 'Archer press-ups', sets: '3 × 5 each side' },
            { name: 'Diamond press-ups', sets: '4 × max' },
            { name: 'Bicycle crunches', sets: '4 × 30 each' },
            { name: 'Hollow body hold', sets: '4 × 35 sec' }
          ]
        },
        fri: {
          day: 'fri', label: 'Short Pull + Core', bar: true,
          note: 'Short (~20 min). Final block of dedicated back work.',
          exercises: [
            { name: 'Pull-ups', sets: '4 × 8' },
            { name: 'Chin-ups', sets: '4 × max' },
            { name: 'Negative pull-ups (5 sec lower)', sets: '3 × 6' },
            { name: 'Dead hang', sets: '2 × 40 sec' },
            { name: 'Hanging leg raises', sets: '4 × 12' }
          ]
        },
        sat: {
          day: 'sat', label: 'Push + Legs + Abs', bar: false,
          note: 'Final push. Leave everything on the floor.',
          exercises: [
            { name: 'Wide press-ups', sets: '5 × max' },
            { name: 'Pike press-ups', sets: '4 × 15+' },
            { name: 'Tricep dips', sets: '4 × 20' },
            { name: 'Jump squats', sets: '5 × 15' },
            { name: 'Walking lunges', sets: '5 × 12 each' },
            { name: 'Calf raises', sets: '4 × 30' },
            { name: 'Hollow body hold', sets: '4 × 40 sec' },
            { name: 'Plank', sets: '3 × 75 sec' }
          ]
        }
      }
    }
  ]
};

export function planForWeek(week: number | null): Phase {
  if (!week || week < 1) return PLAN.phases[0];
  const idx = Math.min(3, Math.floor((week - 1) / 2));
  return PLAN.phases[idx];
}

export function detailedSession(
  weekday: string,
  week: number | null
): Session | null {
  if (!PLAN.trainingDays.includes(weekday)) return null;
  const phase = planForWeek(week);
  return phase.sessions[weekday as 'tue' | 'thu' | 'fri' | 'sat'] ?? null;
}
