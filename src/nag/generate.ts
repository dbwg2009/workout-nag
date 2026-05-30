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

function staticNag(ctx: NagContext): string {
  const level = Math.max(0, Math.min(3, ctx.escalation));
  const bank = STATIC_NAGS[level];
  const tpl = pick(bank, level * 7 + ctx.streak + ctx.minutesLeft);
  return fillTemplate(tpl, ctx);
}

/** Generate a nag via OpenRouter, falling back to static lines on any problem. */
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

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'workout-nag'
      },
      body: JSON.stringify({
        model: ctx.model,
        max_tokens: 120,
        temperature: 0.9,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!res.ok) return staticNag(ctx);
    const data: any = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    const clean = (text ?? '').trim();
    if (!clean || clean.length > 400) return staticNag(ctx);
    return clean;
  } catch {
    return staticNag(ctx);
  }
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
    'Commands: REST (skip today) · SICK [days] · EXAM [yyyy-mm-dd] · SNOOZE [hours] · STATUS.'
  ].join('\n');
}
