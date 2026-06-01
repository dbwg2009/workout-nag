import { Message } from 'discord.js';
import { DateTime } from 'luxon';
import type { Config } from '../config';
import { localNow } from '../../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../../src/core/schedule';
import { verifyProof } from '../../src/core/proof';
import { parseCommand, overrideWindow, type WindowCommand } from '../../src/core/overrides';
import { detectsConcern } from '../../src/core/concern';
import { computeStreak } from '../../src/core/streak';
import { parseWorkout, isWorkoutReport } from '../../src/core/workoutlog';
import { congratsMessage, overrideAck, concernReply, helpMessage, microDoneAck } from '../../src/nag/generate';
import { generateChatReply, type ChatMessage, type CoachLiveData } from '../../src/nag/coach';
import { pushPending } from './timerManager';
import * as repo from '../repo';

function rejectionMessage(reason: string): string {
  switch (reason) {
    case 'duplicate':
      return "I've seen that exact image before. Send a fresh one from today's session.";
    case 'stale-exif':
      return "That photo wasn't taken today. Nice try — send a fresh one.";
    case 'future-exif':
      return "That photo's timestamp is in the future. Check your camera clock and resend.";
    default:
      return 'Could not accept that. Send a fresh photo or fitness screenshot.';
  }
}

async function streakNow(): Promise<number> {
  const recent = await repo.getRecentDays(90);
  return computeStreak(
    recent.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
  );
}

function buildDateTime(cfg: Config, now: Date, week: number | null): string {
  const dt = DateTime.fromJSDate(now).setZone(cfg.tz);
  const dayName = dt.toFormat('cccc');
  const datePart = dt.toFormat('d MMM yyyy');
  const timePart = dt.toFormat('HH:mm');
  const zonePart = dt.toFormat('z');
  const weekPart = week ? `Week ${week} of 8` : 'plan not started';
  return `${dayName} ${datePart}, ${timePart} ${zonePart} — ${weekPart}`;
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
    currentDateTime: buildDateTime(cfg, now, week),
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

// Only include messages that are part of an actual back-and-forth conversation —
// i.e. bot messages that are direct replies to the user (not automated nags).
async function fetchHistory(message: Message, limit = 20): Promise<ChatMessage[]> {
  try {
    const fetched = await message.channel.messages.fetch({ limit, before: message.id });
    const botId = message.client.user?.id;
    const userId = message.author.id;
    const arr = [...fetched.values()].reverse(); // oldest -> newest

    // Build a set of message IDs that are user messages (so we can check if a bot message replied to one)
    const userMsgIds = new Set(arr.filter((m) => m.author.id === userId).map((m) => m.id));

    const out: ChatMessage[] = [];
    for (const m of arr) {
      const content = (m.content ?? '').trim();
      if (!content) continue;
      if (m.author.id === userId) {
        out.push({ role: 'user', content });
      } else if (m.author.id === botId) {
        // Only include bot messages that were direct replies to the user (not automated nags)
        const refId = m.reference?.messageId;
        if (refId && userMsgIds.has(refId)) {
          out.push({ role: 'assistant', content });
        }
      }
    }
    return out.slice(-8);
  } catch {
    return [];
  }
}

function logAck(count: number): string {
  if (count === 0) return 'Logged. Noted it down.';
  return `Logged — ${count} exercise${count > 1 ? 's' : ''} recorded. Good work. Keep stacking them.`;
}

export async function handleIncoming(cfg: Config, message: Message): Promise<void> {
  if (message.author.bot) return;
  if (message.author.id !== cfg.userId) return;
  const inDm = !message.guildId;
  if (!inDm && cfg.channelId && message.channelId !== cfg.channelId) return;

  const now = new Date();
  const ln = localNow(cfg.tz, now);
  const training = isTrainingDay(ln.weekday, cfg.trainingDays);
  const session = sessionFor(ln.weekday, cfg.trainingDays);

  // 0) Push response — user replying yes/no after a surprise timer extension
  const pending = pushPending.get(message.author.id);
  if (pending) {
    const lower = (message.content ?? '').toLowerCase().trim();
    if (/^y(es|ep|eah)?$/.test(lower)) {
      pushPending.delete(message.author.id);
      await message.reply(`Good. ${pending.extraSeconds}s extra is yours now. That's how limits move.`);
      return;
    }
    if (/^no?$/.test(lower)) {
      pushPending.delete(message.author.id);
      await message.reply(`You know where your limit is now. That's the target next time. Build up to it.`);
      return;
    }
    // Unclear reply — fall through to normal handling
    pushPending.delete(message.author.id);
  }

  // 1) Image attachment => proof
  const image = message.attachments.find((a) => (a.contentType ?? '').startsWith('image/'));
  if (image) {
    try {
      const res = await fetch(image.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const knownHashes = await repo.getKnownHashes();
      const result = await verifyProof({ buffer, knownHashes, now });
      const day = await repo.ensureToday(ln.dateStr, training, session);
      if (result.ok) {
        await repo.recordProof(day.id, result.kind, result.hash, result.exifTakenAt);
        await repo.markProven(day.id);
        await message.reply(congratsMessage(await streakNow()));
      } else {
        await message.reply(rejectionMessage(result.reason));
      }
    } catch (err) {
      console.error('[proof] error handling image:', err);
      await message.reply('Something went wrong checking that image. Try again.');
    }
    return;
  }

  const raw = message.content ?? '';
  const cmd = parseCommand(raw);

  // 2) STATUS
  if (cmd && cmd.type === 'status') {
    const day = await repo.ensureToday(ln.dateStr, training, session);
    const active = await repo.getActiveOverrides(now);
    const lines = [
      `Streak: ${await streakNow()} day(s).`,
      training ? `Today: ${session} — status ${day.status}.` : 'Today is a rest day.',
      active.length ? `Active pause: ${active.map((o) => o.kind).join(', ')}.` : 'No active pause.'
    ];
    await message.reply(lines.join('\n'));
    return;
  }

  // 3) /done — marks micro sessions sequentially (morning then evening).
  //    Reject only when today is a training day with a pending workout;
  //    overridden/rest/proven training days are fine to accept /done.
  if (cmd && cmd.type === 'done') {
    const day = await repo.ensureToday(ln.dateStr, training, session);
    if (training && day.status === 'pending') {
      await message.reply('Send a photo or fitness screenshot to prove your workout — /done is for the micro routine.');
    } else if (!day.microDone) {
      await repo.markMicroDone(day.id);
      await message.reply(microDoneAck('morning'));
    } else if (!day.microEveningDone) {
      await repo.markMicroEveningDone(day.id);
      await message.reply(microDoneAck('evening'));
    } else {
      await message.reply('Both micro sessions already logged today. Good work.');
    }
    return;
  }

  // 4) LOG (explicit)
  if (cmd && cmd.type === 'log') {
    const parsed = parseWorkout(cmd.text || raw);
    const day = await repo.ensureToday(ln.dateStr, training, session);
    await repo.addWorkout(day.id, ln.dateStr, cmd.text || raw, parsed);
    await message.reply(logAck(parsed.length));
    return;
  }

  // 5) Override commands (rest/sick/exam/snooze — status/log/done already handled above)
  if (cmd) {
    const wc = cmd as WindowCommand;
    const { startsAt, endsAt } = overrideWindow(wc, cfg.tz, now);
    await repo.addOverride(wc.type, startsAt, endsAt, raw);
    const day = await repo.ensureToday(ln.dateStr, training, session);
    if (training && day.status === 'pending') {
      await repo.setDayStatus(day.id, wc.type === 'rest' ? 'rest' : 'overridden');
    }
    const detail =
      wc.type === 'sick'
        ? `${wc.days} day(s)`
        : wc.type === 'snooze'
          ? `${wc.hours} hour(s)`
          : wc.type === 'exam'
            ? (wc.until ?? 'a week')
            : undefined;
    await message.reply(overrideAck(wc.type, detail));
    return;
  }

  // 5) Distress safety net (before chat) — back off kindly
  if (detectsConcern(raw)) {
    const endOfDay = DateTime.fromJSDate(now).setZone(cfg.tz).endOf('day').toJSDate();
    await repo.addOverride('rest', now, endOfDay, `auto: ${raw.slice(0, 80)}`);
    const day = await repo.ensureToday(ln.dateStr, training, session);
    if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'overridden');
    await message.reply(concernReply());
    return;
  }

  // 6) Quick help
  if (/^(\/help|help|commands?|what can you do)\b/i.test(raw.trim())) {
    await message.reply(helpMessage(cfg.personaName));
    return;
  }

  // 7) Workout report (a statement with sets) => auto-log
  const parsed = parseWorkout(raw);
  if (isWorkoutReport(raw, parsed)) {
    const day = await repo.ensureToday(ln.dateStr, training, session);
    await repo.addWorkout(day.id, ln.dateStr, raw, parsed);
    await message.reply(logAck(parsed.length));
    return;
  }

  // 8) Conversation — Sarge as coach, training is his specialty
  try {
    const ch = message.channel as { sendTyping?: () => Promise<unknown> };
    if (typeof ch.sendTyping === 'function') { try { await ch.sendTyping(); } catch { /* ignore */ } }
    const live = await buildLive(cfg, ln.weekday, ln.dateStr, now);
    const history = await fetchHistory(message);
    const reply = await generateChatReply({
      personaName: cfg.personaName,
      model: cfg.model,
      apiKey: cfg.openRouterKey,
      live,
      history,
      userMessage: raw
    });
    await message.reply(reply);
  } catch (err) {
    console.error('[chat] error:', err);
  }
}
