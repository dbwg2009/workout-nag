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
  streak: number;
  recentDays: { date: string; status: string; sessionName: string | null }[];
  recentWorkouts: { date: string; rawText: string }[];
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    recent ? `Recent days: ${recent}.` : 'No day history yet.',
    workouts ? `Recently logged: ${workouts}.` : 'No logged workouts yet.',
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

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'workout-nag'
      },
      body: JSON.stringify({ model, max_tokens: 350, temperature: 0.8, messages })
    });
    if (!res.ok) return "Couldn't reach my brain just now — try again in a sec.";
    const data: any = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    const clean = (text ?? '').trim();
    return clean || "Didn't catch that — say again?";
  } catch {
    return "My brain's offline right now — try again shortly. (Commands still work.)";
  }
}
