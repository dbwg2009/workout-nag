import 'dotenv/config';

export interface Config {
  databaseUrl: string;
  discordToken: string;
  userId: string;
  channelId: string | null;
  openRouterKey?: string;
  model: string;
  tz: string;
  wakeStart: string;
  wakeEnd: string;
  maxNagsPerDay: number;
  trainingDays: string[];
  planStart: string;
  personaName: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    databaseUrl: required('DATABASE_URL'),
    discordToken: required('DISCORD_TOKEN'),
    userId: required('DISCORD_USER_ID'),
    channelId: process.env.DISCORD_CHANNEL_ID?.trim() || null,
    openRouterKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
    model: process.env.OPENROUTER_MODEL?.trim() || 'meta-llama/llama-3.3-70b-instruct:free',
    tz: process.env.TZ?.trim() || 'Europe/London',
    wakeStart: process.env.WAKE_START?.trim() || '09:00',
    wakeEnd: process.env.WAKE_END?.trim() || '21:00',
    maxNagsPerDay: parseInt(process.env.MAX_NAGS_PER_DAY || '6', 10),
    trainingDays: (process.env.TRAINING_DAYS || 'tue,thu,fri,sat')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    planStart: process.env.PLAN_START?.trim() || '2026-06-02',
    personaName: process.env.PERSONA_NAME?.trim() || 'Sarge'
  };
}
