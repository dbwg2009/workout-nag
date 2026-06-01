import {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody
} from 'discord.js';
import cron from 'node-cron';
import { loadConfig } from './config';
import { localNow, isWithinWake, wakeFraction, parseHm } from '../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../src/core/schedule';
import { decide, decideMicro } from '../src/core/escalation';
import { computeStreak } from '../src/core/streak';
import { generateNag, microNagMessage, microNudgeMorning, microNudgeEvening } from '../src/nag/generate';
import { sendText } from './discord/send';
import { handleIncoming } from './discord/handlers';
import { handleInteraction } from './discord/interactions';
import * as repo from './repo';

const SLASH_COMMANDS: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  { name: 'help', description: 'Show available commands' },
  { name: 'status', description: 'Show today\'s workout status and current streak' },
  { name: 'rest', description: 'Mark today as a rest day — Sarge backs off' },
  {
    name: 'sick',
    description: 'Pause nagging while you\'re ill',
    options: [{ name: 'days', description: 'Number of days (1–14, default 2)', type: ApplicationCommandOptionType.Integer, required: false, min_value: 1, max_value: 14 }]
  },
  {
    name: 'exam',
    description: 'Pause nagging for exam period',
    options: [{ name: 'until', description: 'Date to resume (YYYY-MM-DD)', type: ApplicationCommandOptionType.String, required: false }]
  },
  {
    name: 'snooze',
    description: 'Snooze nags for a few hours',
    options: [{ name: 'hours', description: 'Hours to snooze (1–12, default 2)', type: ApplicationCommandOptionType.Integer, required: false, min_value: 1, max_value: 12 }]
  },
  {
    name: 'log',
    description: 'Log what you did in today\'s workout',
    options: [{ name: 'text', description: 'e.g. "4×10 press-ups, felt strong"', type: ApplicationCommandOptionType.String, required: true }]
  },
  { name: 'done', description: 'Mark the morning micro routine as done (rest days)' },
  {
    name: 'chat',
    description: 'Ask Sarge anything — training advice, form tips, or just chat',
    options: [{ name: 'message', description: 'Your message', type: ApplicationCommandOptionType.String, required: true }]
  }
];

const cfg = loadConfig();

async function currentStreak(): Promise<number> {
  const recent = await repo.getRecentDays(90);
  return computeStreak(
    recent.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
  );
}

async function tick(client: Client): Promise<void> {
  try {
    const now = new Date();
    const ln = localNow(cfg.tz, now);
    const training = isTrainingDay(ln.weekday, cfg.trainingDays);
    const session = sessionFor(ln.weekday, cfg.trainingDays);
    const day = await repo.ensureToday(ln.dateStr, training, session);
    const overrideActive = (await repo.getActiveOverrides(now)).length > 0;
    const withinWake = isWithinWake(ln.minutesSinceMidnight, cfg.wakeStart, cfg.wakeEnd);
    const fraction = wakeFraction(ln.minutesSinceMidnight, cfg.wakeStart, cfg.wakeEnd);
    const sharedSettings = { wakeStart: cfg.wakeStart, wakeEnd: cfg.wakeEnd, maxNagsPerDay: cfg.maxNagsPerDay };
    const tag = `[tick ${ln.dateStr} ${ln.hour}:${String(ln.minute).padStart(2, '0')}]`;

    // Training day nag
    const decision = decide({
      isTrainingDay: training,
      withinWake,
      fraction,
      overrideActive,
      day: { status: day.status, nagCount: day.nagCount, lastNagAt: day.lastNagAt },
      settings: sharedSettings,
      now
    });

    if (decision.action === 'nag') {
      const minutesLeft = Math.max(0, parseHm(cfg.wakeEnd) - ln.minutesSinceMidnight);
      const message = await generateNag({
        escalation: decision.escalation ?? 0,
        streak: await currentStreak(),
        sessionName: session ?? 'your workout',
        weekNumber: weekNumber(ln.dateStr, cfg.planStart),
        minutesLeft,
        model: cfg.model,
        apiKey: cfg.openRouterKey,
        personaName: cfg.personaName
      });
      await sendText(client, cfg, message);
      await repo.recordNag(day.id, decision.escalation ?? 0, message);
      console.log(`${tag} nagged (L${decision.escalation}): ${message.slice(0, 80)}`);
    }

    // Micro routine nag (rest days only, same 15-min tick)
    const microDecision = decideMicro({
      isTrainingDay: training,
      withinWake,
      fraction,
      overrideActive,
      day: { microDone: day.microDone, microNagCount: day.microNagCount, microLastNagAt: day.microLastNagAt },
      settings: sharedSettings,
      now
    });

    if (microDecision.action === 'nag') {
      const isFirstNag = day.microNagCount === 0;
      const msg = isFirstNag
        ? microNudgeMorning(cfg.personaName)
        : microNagMessage(microDecision.escalation ?? 0, cfg.personaName);
      await sendText(client, cfg, msg);
      await repo.recordMicroNag(day.id, microDecision.escalation ?? 0, msg);
      console.log(`${tag} micro nag (L${microDecision.escalation})`);
    } else if (decision.action !== 'nag') {
      console.log(`${tag} silent — ${decision.reason}`);
    }
  } catch (err) {
    console.error('[tick] error:', err);
  }
}

async function main() {
  await repo.ensureSettings();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[ready] ${cfg.personaName} online as ${c.user.tag}. Training days: ${cfg.trainingDays.join(', ')}. TZ: ${cfg.tz}.`);
    // Register slash commands globally (works in DMs + servers).
    // Takes up to 1 hour to propagate on first deploy; instant on restart thereafter.
    void c.application.commands.set(SLASH_COMMANDS)
      .then(() => console.log(`[commands] registered ${SLASH_COMMANDS.length} slash commands`))
      .catch((err) => console.error('[commands] registration failed:', err));
    setTimeout(() => void tick(client), 5000);
  });

  client.on(Events.MessageCreate, (message) => {
    void handleIncoming(cfg, message);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    void handleInteraction(cfg, interaction as ChatInputCommandInteraction);
  });

  // The nag loop: every 15 minutes, in the user's timezone.
  cron.schedule('*/15 * * * *', () => void tick(client), { timezone: cfg.tz });

  // Nightly: finalise yesterday's unproven training days (missed vs overridden).
  cron.schedule(
    '5 0 * * *',
    () => {
      const ln = localNow(cfg.tz);
      void repo.finalizePastDays(ln.dateStr, cfg.tz);
      console.log('[finalize] ran nightly finalisation');
    },
    { timezone: cfg.tz }
  );

  // Evening micro nudge: every day, 1 hr before WAKE_END.
  const wakeEndMins = parseHm(cfg.wakeEnd);
  const eveningMins = wakeEndMins - 60;
  const eveningH = Math.floor(eveningMins / 60);
  const eveningM = eveningMins % 60;
  cron.schedule(
    `${eveningM} ${eveningH} * * *`,
    () => {
      console.log('[micro] sending evening nudge');
      void sendText(client, cfg, microNudgeEvening(cfg.personaName));
    },
    { timezone: cfg.tz }
  );

  await client.login(cfg.discordToken);
}

main().catch((err) => {
  console.error('[fatal] worker failed to start:', err);
  process.exit(1);
});
