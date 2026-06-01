import { buildSystemPrompt } from './persona';
import { detailedSession, planForWeek, WARMUP, PRINCIPLES } from '../data/plan';
import { getProfile, profileSummary, type Profile } from '../data/profile';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachLiveData {
  weekday: string;
  week: number | null;
  isTrainingDay: boolean;
  todayStatus: string; // 'proven' | 'pending' | 'rest' | 'overridden' | 'missed'
  streak: number;
  currentDateTime: string; // e.g. "Monday 2 Jun 2026, 19:32 BST — Week 1 of 8"
  recentDays: { date: string; status: string; sessionName: string | null }[];
  recentWorkouts: { date: string; rawText: string }[];
  planLogs: {
    date: string;
    session: string | null;
    pressups: string | null;
    pullups: string | null;
    squats: string | null;
    plank: string | null;
    weight: string | null;
    notes: string | null;
  }[];
}

function formatPlanLog(l: CoachLiveData['planLogs'][number]): string {
  const bits: string[] = [];
  if (l.pressups) bits.push(`press-ups ${l.pressups}`);
  if (l.pullups) bits.push(`pull-ups ${l.pullups}`);
  if (l.squats) bits.push(`squats ${l.squats}`);
  if (l.plank) bits.push(`plank ${l.plank}`);
  if (l.weight) bits.push(`weight ${l.weight}kg`);
  if (l.notes) bits.push(`"${l.notes}"`);
  return `${l.date}${l.session ? ' (' + l.session + ')' : ''}: ${bits.join(', ') || 'logged'}`;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Tried in order after the configured model when the free pool is throttled.
const FREE_FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free'
];

function sessionBlock(weekday: string, week: number | null): string {
  const s = detailedSession(weekday, week);
  if (!s) return 'Today is a REST day — no session scheduled.';
  const ex = s.exercises.map((e) => `${e.name} — ${e.sets}`).join('; ');
  return `Today's session is "${s.label}"${s.bar ? ' (needs the pull-up bar)' : ''}. Exercises: ${ex}. Coach note: ${s.note}`;
}

export function buildCoachSystemPrompt(personaName: string, live: CoachLiveData): string {
  const profile: Profile = getProfile();
  const phase = planForWeek(live.week);
  const recent = live.recentDays
    .slice(0, 7)
    .map((d) => `${d.date}: ${d.status}`)
    .join(', ');
  const workouts = live.recentWorkouts
    .slice(0, 8)
    .map((w) => `${w.date}: ${w.rawText}`)
    .join(' | ');
  const sitelogs = live.planLogs
    .slice(0, 8)
    .map(formatPlanLog)
    .join(' | ');

  const workoutPending = live.isTrainingDay && live.todayStatus === 'pending';

  return [
    buildSystemPrompt(personaName),
    '',
    workoutPending
      ? 'In this conversation mode you are his coach. His workout is still pending today — you can briefly remind him, but respond to what he actually says first. Keep replies to a few sentences unless he asks for detail.'
      : 'In this conversation mode you are his coach. IMPORTANT: his workout is either done or today is a rest day — do NOT mention working out, the session, or the warm-up AT ALL unless he brings it up first. Just talk normally. Keep replies to a few sentences unless he asks for detail.',
    '',
    '=== WHO HE IS ===',
    profileSummary(profile),
    '',
    '=== HIS PROGRAMME ===',
    `Currently Phase ${phase.phase} (${phase.name}, weeks ${phase.weeks}): ${phase.focus}`,
    `Week of plan: ${live.week ?? 'not started yet'}.`,
    workoutPending ? sessionBlock(live.weekday, live.week) : (live.isTrainingDay ? `Today's session is scheduled but already completed.` : 'Today is a rest day.'),
    workoutPending ? `Warm-up: ${WARMUP.join('; ')}.` : null,
    '',
    '=== PRINCIPLES (follow these in any advice — only share if he asks) ===',
    PRINCIPLES.map((p) => `- ${p}`).join('\n'),
    '',
    '=== CURRENT DATE & TIME ===',
    live.currentDateTime,
    '',
    '=== HIS PROGRESS ===',
    `Current streak: ${live.streak} day(s).`,
    live.isTrainingDay
      ? `Today's workout: ${live.todayStatus === 'proven' ? 'DONE.' : live.todayStatus === 'overridden' ? 'paused (rest/sick/exam).' : live.todayStatus === 'pending' ? 'still pending.' : live.todayStatus}.`
      : 'Today is a rest day.',
    recent ? `Recent days: ${recent}.` : 'No day history yet.',
    workouts ? `Recently logged: ${workouts}.` : 'No logged workouts yet.',
    sitelogs ? `Numbers logged on the training site: ${sitelogs}.` : null,
    '',
    '=== COACHING RULES ===',
    '- He is a teenager. Never push him to train through illness or injury — tell him to rest. Only mention exams or revision if he brings it up first.',
    '- He is lean and BUILDING muscle: never suggest cutting, restricting food, or losing weight. Encourage eating enough and protein.',
    '- Never comment negatively on his body, weight or appearance. Push effort and consistency, never shame.',
    '- Only give training advice (form tips, session details, progression) if he asks for it.',
    '- If you are not sure about something, say so honestly rather than inventing it.'
  ].filter((line) => line !== null).join('\n');
}

export async function generateChatReply(opts: {
  personaName: string;
  model: string;
  apiKey?: string;
  live: CoachLiveData;
  history: ChatMessage[];
  userMessage: string;
}): Promise<string> {
  const { personaName, model, apiKey, live, history, userMessage } = opts;
  if (!apiKey) {
    return (
      "My brain's offline — no OpenRouter key set, so I can't chat freely. " +
      'But commands still work: send a photo to log a workout, or /rest /sick /exam /snooze /status /log.'
    );
  }

  const messages = [
    { role: 'system', content: buildCoachSystemPrompt(personaName, live) },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  // The configured model first, then other free models. The free pool gets
  // throttled upstream per-provider, so falling back keeps chat alive at £0.
  const tried = new Set<string>();
  const chain = [model, ...FREE_FALLBACK_MODELS].filter((m) => {
    if (!m || tried.has(m)) return false;
    tried.add(m);
    return true;
  });

  let sawRateLimit = false;
  for (const m of chain) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/dbwg2009/workout-nag',
          'X-Title': 'workout-nag'
        },
        body: JSON.stringify({ model: m, max_tokens: 350, temperature: 0.8, messages })
      });

      if (res.ok) {
        const data: any = await res.json();
        const text = (data?.choices?.[0]?.message?.content ?? '').trim();
        if (text) return text;
        console.error('[coach] OpenRouter OK but empty from', m, JSON.stringify(data).slice(0, 300));
        continue; // try next model
      }

      const body = await res.text().catch(() => '');
      console.error(`[coach] OpenRouter ${res.status} from ${m}: ${body.slice(0, 300)}`);
      // Auth/payment problems won't be fixed by another model — bail with advice.
      if (res.status === 401)
        return "My API key's being rejected (401). Double-check OPENROUTER_API_KEY in .env, then restart me.";
      if (res.status === 402)
        return 'OpenRouter says payment required (402) — switch OPENROUTER_MODEL or add a little balance.';
      if (res.status === 429) sawRateLimit = true;
      // 429 and other errors: fall through to the next model
    } catch (err) {
      console.error('[coach] OpenRouter fetch threw for', m, err);
    }
  }

  if (sawRateLimit)
    return 'All the free models are busy right now — try me again in a minute. (For zero rate-limits, add a few OpenRouter credits and use a paid model.)';
  return "Couldn't reach my brain right now — try again shortly. (Commands still work.)";
}
