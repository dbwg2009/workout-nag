import { ChatInputCommandInteraction } from 'discord.js';
import { DateTime } from 'luxon';
import type { Config } from '../config';
import { localNow, formatDateTime } from '../../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../../src/core/schedule';
import { overrideWindow, type WindowCommand } from '../../src/core/overrides';
import { detectsConcern } from '../../src/core/concern';
import { computeStreak } from '../../src/core/streak';
import { parseWorkout } from '../../src/core/workoutlog';
import { overrideAck, concernReply, helpMessage, microDoneAck } from '../../src/nag/generate';
import { generateChatReply, type CoachLiveData } from '../../src/nag/coach';
import { lookupTimer } from '../../src/core/timer';
import { startTimer } from './timerManager';
import { startWorkout, cancelWorkout } from './workoutMode';
import * as repo from '../repo';

async function streakNow(): Promise<number> {
  const recent = await repo.getRecentDays(90);
  return computeStreak(
    recent.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
  );
}

async function buildLive(cfg: Config, weekday: string, dateStr: string, now: Date = new Date()): Promise<CoachLiveData> {
  const week = weekNumber(dateStr, cfg.planStart);
  const training = isTrainingDay(weekday, cfg.trainingDays);
  const session = sessionFor(weekday, cfg.trainingDays);
  const [day, recentDays, recentWorkouts, planLogs] = await Promise.all([
    repo.ensureToday(dateStr, training, session),
    repo.getRecentDays(14),
    repo.getRecentWorkouts(10),
    repo.getRecentPlanLogs(10)
  ]);
  return {
    weekday,
    week,
    isTrainingDay: training,
    todayStatus: day.status,
    currentDateTime: formatDateTime(cfg.tz, now, week),
    streak: computeStreak(
      recentDays.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
    ),
    recentDays: recentDays.map((d) => ({ date: d.date, status: d.status, sessionName: d.sessionName })),
    recentWorkouts: recentWorkouts.map((w) => ({ date: w.date, rawText: w.rawText })),
    planLogs: planLogs.map((l) => ({
      date: l.date,
      session: l.session,
      pressups: l.pressups,
      pullups: l.pullups,
      squats: l.squats,
      plank: l.plank,
      weight: l.weight,
      notes: l.notes
    }))
  };
}

export async function handleInteraction(cfg: Config, interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.user.id !== cfg.userId) {
    await interaction.reply({ content: "You're not my commanding officer.", ephemeral: true });
    return;
  }

  const now = new Date();
  const ln = localNow(cfg.tz, now);
  const training = isTrainingDay(ln.weekday, cfg.trainingDays);
  const session = sessionFor(ln.weekday, cfg.trainingDays);
  const cmd = interaction.commandName;

  try {
    if (cmd === 'help') {
      await interaction.reply(helpMessage(cfg.personaName));
      return;
    }

    if (cmd === 'status') {
      const day = await repo.ensureToday(ln.dateStr, training, session);
      const active = await repo.getActiveOverrides(now);
      const lines = [
        `Streak: ${await streakNow()} day(s).`,
        training ? `Today: ${session} — status ${day.status}.` : 'Today is a rest day.',
        active.length ? `Active pause: ${active.map((o) => o.kind).join(', ')}.` : 'No active pause.'
      ];
      await interaction.reply(lines.join('\n'));
      return;
    }

    if (cmd === 'log') {
      const text = interaction.options.getString('text', true);
      const parsed = parseWorkout(text);
      const day = await repo.ensureToday(ln.dateStr, training, session);
      await repo.addWorkout(day.id, ln.dateStr, text, parsed);
      const count = parsed.length;
      await interaction.reply(
        count === 0 ? 'Logged. Noted it down.' : `Logged — ${count} exercise${count > 1 ? 's' : ''} recorded. Good work. Keep stacking them.`
      );
      return;
    }

    if (cmd === 'done') {
      const day = await repo.ensureToday(ln.dateStr, training, session);
      if (training && day.status === 'pending') {
        await interaction.reply('Send a photo or fitness screenshot to prove your workout — /done is for the micro routine.');
      } else if (!day.microDone) {
        await repo.markMicroDone(day.id);
        await interaction.reply(microDoneAck('morning'));
      } else if (!day.microEveningDone) {
        await repo.markMicroEveningDone(day.id);
        await interaction.reply(microDoneAck('evening'));
      } else {
        await interaction.reply('Both micro sessions already logged today. Good work.');
      }
      return;
    }

    if (cmd === 'rest') {
      const wc: WindowCommand = { type: 'rest' };
      const { startsAt, endsAt } = overrideWindow(wc, cfg.tz, now);
      await repo.addOverride('rest', startsAt, endsAt);
      const day = await repo.ensureToday(ln.dateStr, training, session);
      if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'rest');
      await interaction.reply(overrideAck('rest'));
      return;
    }

    if (cmd === 'sick') {
      const days = interaction.options.getInteger('days') ?? 2;
      const clamped = Math.max(1, Math.min(14, days));
      const wc: WindowCommand = { type: 'sick', days: clamped };
      const { startsAt, endsAt } = overrideWindow(wc, cfg.tz, now);
      await repo.addOverride('sick', startsAt, endsAt);
      const day = await repo.ensureToday(ln.dateStr, training, session);
      if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'overridden');
      await interaction.reply(overrideAck('sick', `${clamped} day(s)`));
      return;
    }

    if (cmd === 'exam') {
      const until = interaction.options.getString('until') ?? null;
      const wc: WindowCommand = { type: 'exam', until };
      const { startsAt, endsAt } = overrideWindow(wc, cfg.tz, now);
      await repo.addOverride('exam', startsAt, endsAt);
      const day = await repo.ensureToday(ln.dateStr, training, session);
      if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'overridden');
      await interaction.reply(overrideAck('exam', until ?? undefined));
      return;
    }

    if (cmd === 'snooze') {
      const hours = interaction.options.getInteger('hours') ?? 2;
      const clamped = Math.max(1, Math.min(12, hours));
      const wc: WindowCommand = { type: 'snooze', hours: clamped };
      const { startsAt, endsAt } = overrideWindow(wc, cfg.tz, now);
      await repo.addOverride('snooze', startsAt, endsAt);
      await interaction.reply(overrideAck('snooze', `${clamped} hour(s)`));
      return;
    }

    if (cmd === 'workout') {
      await interaction.reply('Loading today\'s session…');
      await startWorkout(interaction.client, cfg, interaction.user.id, interaction.channelId);
      return;
    }

    if (cmd === 'cancel') {
      await interaction.reply('Stopping session.');
      await cancelWorkout(interaction.user.id, interaction.client, interaction.channelId);
      return;
    }

    // /timer — countdown timer for an exercise hold or rest period
    // With no arguments, defaults to a 60s rest timer.
    if (cmd === 'timer') {
      const exerciseInput = interaction.options.getString('exercise') ?? null;
      const overrideSecs = interaction.options.getInteger('seconds') ?? undefined;

      if (!exerciseInput) {
        // Pure rest timer — no exercise lookup needed
        const seconds = overrideSecs ?? 60;
        await interaction.reply(`Rest. **${seconds}s.**`);
        await startTimer({
          client: interaction.client,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          exerciseName: 'Rest',
          seconds,
          pushEnabled: false,
          maxPushSeconds: 0,
          isRest: true
        });
        return;
      }

      const week = weekNumber(ln.dateStr, cfg.planStart);
      const result = lookupTimer(exerciseInput, ln.weekday, week, overrideSecs, cfg.trainingDays);
      if (!result.found) {
        await interaction.reply(
          `I don't know "${exerciseInput}" — it's not in today's session or the micro routine. Tell me how many seconds and I'll run it: \`/timer ${exerciseInput} 30\``
        );
        return;
      }
      const isRest = result.name.toLowerCase() === 'rest';
      const sourceNote =
        result.source === 'upcoming'
          ? ` (from your next ${result.upcomingDay} session)`
          : result.source === 'micro'
          ? ' (micro routine)'
          : '';
      await interaction.reply(`Starting timer: **${result.name}** — ${result.seconds}s${sourceNote}.`);
      await startTimer({
        client: interaction.client,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        exerciseName: result.name,
        seconds: result.seconds,
        pushEnabled: cfg.timerPushEnabled,
        maxPushSeconds: cfg.timerMaxPushSeconds,
        isRest
      });
      return;
    }

    // /chat — free-text message to Sarge as coach
    if (cmd === 'chat') {
      const text = interaction.options.getString('message', true);
      if (detectsConcern(text)) {
        const endOfDay = DateTime.fromJSDate(now).setZone(cfg.tz).endOf('day').toJSDate();
        await repo.addOverride('rest', now, endOfDay, `auto: ${text.slice(0, 80)}`);
        const day = await repo.ensureToday(ln.dateStr, training, session);
        if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'overridden');
        await interaction.reply(concernReply());
        return;
      }
      await interaction.deferReply();
      const live = await buildLive(cfg, ln.weekday, ln.dateStr, now);
      const reply = await generateChatReply({
        personaName: cfg.personaName,
        model: cfg.model,
        apiKey: cfg.openRouterKey,
        live,
        history: [],
        userMessage: text
      });
      await interaction.editReply(reply);
      return;
    }
  } catch (err) {
    console.error(`[interaction] /${cmd} error:`, err);
    const msg = 'Something went wrong. Try again or use text commands.';
    if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
}
