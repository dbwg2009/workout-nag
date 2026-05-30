import { Message } from 'discord.js';
import { DateTime } from 'luxon';
import type { Config } from '../config';
import { localNow } from '../../src/core/time';
import { isTrainingDay, sessionFor } from '../../src/core/schedule';
import { verifyProof } from '../../src/core/proof';
import { parseCommand, overrideWindow, type WindowCommand } from '../../src/core/overrides';
import { detectsConcern } from '../../src/core/concern';
import { computeStreak } from '../../src/core/streak';
import {
  congratsMessage,
  overrideAck,
  concernReply,
  helpMessage
} from '../../src/nag/generate';
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
    recent.map((d) => ({
      dateStr: d.date,
      isTrainingDay: d.isTrainingDay,
      status: d.status
    }))
  );
}

export async function handleIncoming(cfg: Config, message: Message): Promise<void> {
  if (message.author.bot) return;
  if (message.author.id !== cfg.userId) return;
  // Only act in the configured channel or in a DM.
  const inDm = !message.guildId;
  if (!inDm && cfg.channelId && message.channelId !== cfg.channelId) return;

  const now = new Date();
  const ln = localNow(cfg.tz, now);
  const training = isTrainingDay(ln.weekday, cfg.trainingDays);
  const session = sessionFor(ln.weekday, cfg.trainingDays);

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
        const streak = await streakNow();
        await message.reply(congratsMessage(streak));
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

  // 2) Explicit commands
  if (cmd && cmd.type === 'status') {
    const day = await repo.ensureToday(ln.dateStr, training, session);
    const streak = await streakNow();
    const active = await repo.getActiveOverrides(now);
    const lines = [
      `Streak: ${streak} day(s).`,
      training ? `Today: ${session} — status ${day.status}.` : 'Today is a rest day.',
      active.length ? `Active pause: ${active.map((o) => o.kind).join(', ')}.` : 'No active pause.'
    ];
    await message.reply(lines.join('\n'));
    return;
  }

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

  // 3) Free text — safety net for distress, else only respond to "help"
  if (detectsConcern(raw)) {
    const endOfDay = DateTime.fromJSDate(now).setZone(cfg.tz).endOf('day').toJSDate();
    await repo.addOverride('rest', now, endOfDay, `auto: ${raw.slice(0, 80)}`);
    const day = await repo.ensureToday(ln.dateStr, training, session);
    if (training && day.status === 'pending') await repo.setDayStatus(day.id, 'overridden');
    await message.reply(concernReply());
    return;
  }

  if (/\b(help|commands?|\?)\b/i.test(raw)) {
    await message.reply(helpMessage(cfg.personaName));
  }
}
