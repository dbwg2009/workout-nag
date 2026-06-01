import { ChatInputCommandInteraction } from 'discord.js';
import { DateTime } from 'luxon';
import type { Config } from '../config';
import { localNow } from '../../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../../src/core/schedule';
import { overrideWindow, type WindowCommand } from '../../src/core/overrides';
import { detectsConcern } from '../../src/core/concern';
import { computeStreak } from '../../src/core/streak';
import { parseWorkout } from '../../src/core/workoutlog';
import { overrideAck, concernReply, helpMessage, microDoneAck } from '../../src/nag/generate';
import { generateChatReply, type CoachLiveData } from '../../src/nag/coach';
import * as repo from '../repo';

async function streakNow(): Promise<number> {
  const recent = await repo.getRecentDays(90);
  return computeStreak(
    recent.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
  );
}

async function buildLive(cfg: Config, weekday: string, dateStr: string): Promise<CoachLiveData> {
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
      } else {
        await repo.markMicroDone(day.id);
        await interaction.reply(microDoneAck());
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
      const live = await buildLive(cfg, ln.weekday, ln.dateStr);
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
