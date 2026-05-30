/**
 * Safety net: detect that the user is ill / injured / overwhelmed from free text,
 * so the bot can back off and respond kindly even without an explicit command and
 * even if the LLM is unavailable.
 */
const CONCERN_PATTERNS: RegExp[] = [
  /\b(i'?m|i am|feeling|really|so)\s+(ill|sick|unwell|poorly|rough)\b/,
  /\b(injured|injury|hurt (my|myself)|pulled|sprained|strained|in pain)\b/,
  /\b(exhausted|knackered|shattered|burnt? ?out|burned ?out|so tired|no energy)\b/,
  /\b(overwhelmed|stressed out|can'?t cope|too much going on)\b/,
  /\bnot feeling (it|well|great|good)\b/,
  /\bcan'?t (do it|train|face|manage)( today)?\b/,
  /\b(exam|exams|revision|revising)\b/
];

export function detectsConcern(raw: string): boolean {
  const t = raw.toLowerCase();
  return CONCERN_PATTERNS.some((re) => re.test(t));
}
