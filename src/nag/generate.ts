import { buildSystemPrompt, STATIC_NAGS, CONGRATS, pick, fillTemplate } from './persona';

export interface NagContext {
  escalation: number;
  streak: number;
  sessionName: string;
  weekNumber: number | null;
  minutesLeft: number;
  model: string;
  apiKey?: string;
  personaName: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const FREE_FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free'
];

function staticNag(ctx: NagContext): string {
  const level = Math.max(0, Math.min(3, ctx.escalation));
  const bank = STATIC_NAGS[level];
  const tpl = pick(bank, level * 7 + ctx.streak + ctx.minutesLeft);
  return fillTemplate(tpl, ctx);
}

/** Generate a nag via OpenRouter, falling back across free models then to static. */
export async function generateNag(ctx: NagContext): Promise<string> {
  if (!ctx.apiKey) return staticNag(ctx);

  const system = buildSystemPrompt(ctx.personaName);
  const weekBit = ctx.weekNumber ? ` It is week ${ctx.weekNumber} of his plan.` : '';
  const user =
    `Escalation level: ${ctx.escalation} (0 easy, 3 final).` +
    ` Current streak: ${ctx.streak} days.` +
    ` Today's session: ${ctx.sessionName}.` +
    ` Minutes left in his day: ${ctx.minutesLeft}.${weekBit}` +
    ` Write one short nag.`;

  const tried = new Set<string>();
  const chain = [ctx.model, ...FREE_FALLBACK_MODELS].filter((m) => {
    if (!m || tried.has(m)) return false;
    tried.add(m);
    return true;
  });

  for (const m of chain) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/dbwg2009/workout-nag',
          'X-Title': 'workout-nag'
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 120,
          temperature: 0.9,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        const text: string | undefined = data?.choices?.[0]?.message?.content;
        const clean = (text ?? '').trim();
        if (clean && clean.length <= 400) return clean;
        console.error('[nag] OpenRouter OK but bad response from', m, '— trying next');
        continue;
      }

      const body = await res.text().catch(() => '');
      console.error(`[nag] OpenRouter ${res.status} from ${m}: ${body.slice(0, 300)}`);
      if (res.status === 401)
        return "My API key's being rejected (401). Double-check OPENROUTER_API_KEY in .env, then restart me.";
      if (res.status === 402)
        return 'OpenRouter says payment required (402) — switch OPENROUTER_MODEL or add a little balance.';
      // 429 or other: try next model
    } catch (err) {
      console.error('[nag] OpenRouter fetch threw for', m, err);
    }
  }

  return staticNag(ctx);
}

export function congratsMessage(streak: number): string {
  return fillTemplate(pick(CONGRATS, streak), { streak });
}

/** Deterministic, controlled replies — never LLM-generated, so they're always safe. */
export function overrideAck(kind: 'rest' | 'sick' | 'exam' | 'snooze', detail?: string): string {
  switch (kind) {
    case 'rest':
      return 'Rest day logged. Recovery *is* training — I\'ll leave you be today. 🫡';
    case 'sick':
      return `Resting up${detail ? ` for ${detail}` : ''}. No nagging — get well, that's an order. Reply STATUS anytime.`;
    case 'exam':
      return `Exam mode on${detail ? ` until ${detail}` : ''}. Revision wins, full stop. I'll back off — go smash it. 📚`;
    case 'snooze':
      return `Off your back${detail ? ` for ${detail}` : ' for a bit'}. Clock's ticking though.`;
  }
}

export function concernReply(): string {
  return (
    'Hey — that comes first, genuinely. Forget the workout today and look after yourself. ' +
    "I've paused for the rest of the day; reply SICK 3 or EXAM if you need longer. Rest up."
  );
}

export function helpMessage(personaName: string): string {
  return [
    `I'm ${personaName}. I nag you on training days until you send proof (a photo or fitness screenshot).`,
    'You can also just talk to me — ask about today\'s session, form, swaps, progression, or how your streak\'s going.',
    'Commands: /log [what you did] · /rest · /sick [days] · /exam [yyyy-mm-dd] · /snooze [hours] · /status · /done (rest days — marks micro routine done)'
  ].join('\n');
}

const MICRO_MORNING_ROUTINE = [
  '• Arm circles forward + back — 30 sec',
  '• 10 × slow press-ups — ~1 min',
  '• Plank hold — 30 sec',
  '• 10 × bodyweight squats — ~1 min',
  '• Chest doorframe stretch — 30 sec'
].join('\n');

export function microNudgeMorning(personaName: string): string {
  return [
    `Morning micro routine — under 5 mins, ${personaName} out:`,
    MICRO_MORNING_ROUTINE,
    'These compound fast. Don\'t skip them. Reply /done when finished.'
  ].join('\n');
}

const MICRO_NAG_MESSAGES = [
  (name: string) =>
    `Micro routine still not done. 5 minutes, that's all I'm asking.\n${MICRO_MORNING_ROUTINE}\nReply /done when finished.`,
  (name: string) =>
    `Still waiting on that micro routine. Arm circles to chest stretch — you've done it before, you can do it now.\n${MICRO_MORNING_ROUTINE}\nReply /done.`,
  (name: string) =>
    `${name} does NOT accept "later". Micro routine. Now.\n${MICRO_MORNING_ROUTINE}\n/done when it's done.`,
  (name: string) =>
    `Last call. That 5-minute routine is the difference between stiff and ready. Get it done.\n${MICRO_MORNING_ROUTINE}\n/done.`
];

export function microNagMessage(escalation: number, personaName: string): string {
  const level = Math.max(0, Math.min(3, escalation));
  return MICRO_NAG_MESSAGES[level](personaName);
}

export function microDoneAck(session: 'morning' | 'evening'): string {
  return session === 'morning'
    ? 'Morning routine logged. Good habit. See you tonight for the evening stretch.'
    : 'Evening stretch logged. Both sessions done today. Rest up.';
}

export function microNudgeEvening(personaName: string): string {
  return [
    `Evening micro routine — 1 hr before sleep, ${personaName} out:`,
    '• Chest doorframe stretch — 30 sec',
    '• Lat stretch (arm overhead, lean each side) — 30 sec ea',
    '• Hollow body hold — 20 sec',
    '• Hip flexor stretch (from lunge) — 30 sec ea',
    '• Slow deep breathing — 4 in, hold 4, out 6 — 1 min',
    'Improves sleep quality — your biggest recovery lever.'
  ].join('\n');
}
