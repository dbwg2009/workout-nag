import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import cron from 'node-cron';
import { loadConfig } from './config';
import { localNow, isWithinWake, wakeFraction, parseHm } from '../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../src/core/schedule';
import { decide } from '../src/core/escalation';
import { computeStreak } from '../src/core/streak';
import { generateNag } from '../src/nag/generate';
import { sendText } from './discord/send';
import { handleIncoming } from './discord/handlers';
import * as repo from './repo';

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

    const decision = decide({
      isTrainingDay: training,
      withinWake: isWithinWake(ln.minutesSinceMidnight, cfg.wakeStart, cfg.wakeEnd),
      fraction: wakeFraction(ln.minutesSinceMidnight, cfg.wakeStart, cfg.wakeEnd),
      overrideActive,
      day: { status: day.status, nagCount: day.nagCount, lastNagAt: day.lastNagAt },
      settings: { wakeStart: cfg.wakeStart, wakeEnd: cfg.wakeEnd, maxNagsPerDay: cfg.maxNagsPerDay },
      now
    });

    if (decision.action !== 'nag') {
      console.log(`[tick ${ln.dateStr} ${ln.hour}:${String(ln.minute).padStart(2, '0')}] silent — ${decision.reason}`);
      return;
    }

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
    console.log(`[tick] nagged (L${decision.escalation}): ${message}`);
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
    setTimeout(() => void tick(client), 5000);
  });

  client.on(Events.MessageCreate, (message) => {
    void handleIncoming(cfg, message);
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

  await client.login(cfg.discordToken);
}

main().catch((err) => {
  console.error('[fatal] worker failed to start:', err);
  process.exit(1);
});
