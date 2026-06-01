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

  return [
    buildSystemPrompt(personaName),
    '',
    'You are also his knowledgeable coach. Training is your specialty, but you can chat about anything — keep off-topic replies short and steer back to training when it feels natural. Keep replies to a few sentences unless he asks for detail.',
    '',
    '=== WHO HE IS ===',
    profileSummary(profile),
    '',
    '=== HIS PROGRAMME ===',
    `Currently Phase ${phase.phase} (${phase.name}, weeks ${phase.weeks}): ${phase.focus}`,
    `Week of plan: ${live.week ?? 'not started yet'}.`,
    sessionBlock(live.weekday, live.week),
    `Warm-up: ${WARMUP.join('; ')}.`,
    '',
    '=== PRINCIPLES (follow these in any advice) ===',
    PRINCIPLES.map((p) => `- ${p}`).join('\n'),
    '',
    '=== HIS PROGRESS ===',
    `Current streak: ${live.streak} day(s).`,
    live.isTrainingDay
      ? `Today's workout: ${live.todayStatus === 'proven' ? 'DONE — he has already submitted proof today. Do NOT tell him to work out.' : live.todayStatus === 'overridden' ? 'overridden (rest/sick/exam pause active).' : live.todayStatus === 'pending' ? 'still pending — he has not yet proved his workout.' : live.todayStatus}.`
      : 'Today is a rest day.',
    recent ? `Recent days: ${recent}.` : 'No day history yet.',
    workouts ? `Recently logged: ${workouts}.` : 'No logged workouts yet.',
    sitelogs ? `Numbers logged on the training site: ${sitelogs}.` : '',
    '',
    '=== COACHING RULES ===',
    '- He is a teenager mid-GCSEs. Never push him to train through illness, injury, or exam stress — tell him to rest, and that exams and recovery come first.',
    '- He is lean and BUILDING muscle: never suggest cutting, restricting food, or losing weight. Encourage eating enough and protein.',
    '- Never comment negatively on his body, weight or appearance. Push effort and consistency, never shame.',
    '- Give form tips, sensible exercise swaps, and progression advice grounded in his plan and the principles above.',
    '- If you are not sure about something, say so honestly rather than inventing it.'
  ].join('\n');
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
      'But commands still work: send a photo to log a workout, or REST / SICK / EXAM / SNOOZE / STATUS / LOG.'
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
