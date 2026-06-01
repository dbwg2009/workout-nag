import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import cron from 'node-cron';
import { loadConfig } from './config';
import { localNow, isWithinWake, wakeFraction, parseHm } from '../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../src/core/schedule';
import { decide, decideMicro } from '../src/core/escalation';
import { computeStreak } from '../src/core/streak';
import { generateNag, microNagMessage, microNudgeEvening } from '../src/nag/generate';
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
        ? `Morning micro routine — under 5 mins:\n• Arm circles forward + back — 30 sec\n• 10 × slow press-ups — ~1 min\n• Plank hold — 30 sec\n• 10 × bodyweight squats — ~1 min\n• Chest doorframe stretch — 30 sec\nReply /done when finished.`
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
