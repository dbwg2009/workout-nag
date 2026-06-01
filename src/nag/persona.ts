/**
 * Drill-sergeant persona — blunt, no excuses — but with hard, non-negotiable
 * guardrails. The guardrails live in the prompt itself, not bolted on after.
 */
export function buildSystemPrompt(personaName: string): string {
  return [
    `You are ${personaName}, a blunt, no-excuses drill-sergeant workout accountability coach for Dan, a teenager sitting his GCSE exams.`,
    ``,
    `STYLE: terse, punchy, a bit intimidating, military flavour. 1–2 sentences MAX. No emoji spam (one is fine). Escalate intensity with the level you're given.`,
    ``,
    `ABSOLUTE RULES — never break these, they override the persona:`,
    `- Never cruel. Never insult his body, weight, looks, or worth. No appearance-based shame, EVER. Push effort, never attack the person.`,
    `- If he says he is ill, injured, exhausted, or overwhelmed by exams/revision: instantly drop the drill-sergeant act, respond with genuine warmth, tell him to rest — recovery and exams come first — and stop pushing.`,
    `- At level 2 and above, always remind him he can use /rest, /sick, or /exam to pause with zero guilt.`,
    `- Never threaten real consequences (money, blocking devices, contacting people). You only nag.`,
    ``,
    `You will be given: escalation level (0 easy-going to 3 final push), current streak, today's session name, and minutes left in the day. Use them. Output only the message text.`
  ].join('\n');
}

/** Static fallback nags (used when no OpenRouter key, or the API fails). */
export const STATIC_NAGS: string[][] = [
  [
    'Morning. {session} on the board today. When are we doing it?',
    "Today's a training day: {session}. Don't let it drift. Plan it now.",
    'Up and at it. {session} is the mission today. Give me a time.'
  ],
  [
    'Still pending. 20 minutes of {session}, that\'s all I\'m asking. Move.',
    'Half the day\'s gone and {session} isn\'t done. Get it started.',
    'No workout logged yet. {session}. Stop scrolling, start moving.'
  ],
  [
    'You said you would. Don\'t break a {streak}-day streak over a lazy afternoon. (Reply /rest, /sick, or /exam if you genuinely need to pause.)',
    '{session} is still undone and the day\'s running out. Prove it. (/rest, /sick, or /exam pauses me, no guilt.)',
    'Clock\'s against you. Get {session} done and send proof. (Reply /rest, /sick, or /exam if you must.)'
  ],
  [
    'Last call. Prove {session} before the day ends or it\'s a miss. Or reply /rest, /sick, or /exam — no shame in it.',
    'Final push. {minutesLeft} min left. {session}, then photo. Or tell me /rest, /sick, or /exam.',
    'This is it. Don\'t end the day with a miss. {session} now — or /rest, /sick, or /exam if you truly need it.'
  ]
];

export const CONGRATS: string[] = [
  'Good. Logged. Streak: {streak}. Don\'t get comfortable.',
  'Proof accepted. {streak} days and counting. Same again next session.',
  'That\'ll do. Streak\'s at {streak}. Dismissed.',
  'Logged and verified. {streak}-day streak. Respect — now rest up properly.'
];

export function pick(arr: string[], seed: number): string {
  return arr[Math.abs(seed) % arr.length];
}

export function fillTemplate(
  tpl: string,
  vars: { session?: string; streak?: number; minutesLeft?: number }
): string {
  return tpl
    .replace(/\{session\}/g, vars.session ?? 'your workout')
    .replace(/\{streak\}/g, String(vars.streak ?? 0))
    .replace(/\{minutesLeft\}/g, String(vars.minutesLeft ?? 0));
}
