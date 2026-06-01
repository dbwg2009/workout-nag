import type { Client, TextBasedChannel } from 'discord.js';
import { shouldPush, pushSeconds } from '../../src/core/timer';

interface ActiveTimer {
  halfway: ReturnType<typeof setTimeout>;
  end: ReturnType<typeof setTimeout>;
}

export interface PushPending {
  extraSeconds: number;
  exerciseName: string;
  channelId: string;
}

const activeTimers = new Map<string, ActiveTimer>();
export const pushPending = new Map<string, PushPending>();

async function getChannel(client: Client, channelId: string): Promise<TextBasedChannel | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    return ch && 'send' in ch ? (ch as TextBasedChannel) : null;
  } catch {
    return null;
  }
}

export function cancelTimer(userId: string): void {
  const t = activeTimers.get(userId);
  if (t) {
    clearTimeout(t.halfway);
    clearTimeout(t.end);
    activeTimers.delete(userId);
  }
}

export async function startTimer(opts: {
  client: Client;
  channelId: string;
  userId: string;
  exerciseName: string;
  seconds: number;
  pushEnabled: boolean;
  maxPushSeconds: number;
}): Promise<void> {
  const { client, channelId, userId, exerciseName, seconds, pushEnabled, maxPushSeconds } = opts;

  cancelTimer(userId);

  const extra = shouldPush(pushEnabled) ? pushSeconds(maxPushSeconds) : 0;
  const total = seconds + extra;

  const ch = await getChannel(client, channelId);
  if (!ch) return;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const label = mins > 0 ? `${mins}m ${secs > 0 ? secs + 's' : ''}`.trim() : `${seconds}s`;

  await ch.send(`5… 4… 3… 2… 1… GO. **${exerciseName}** — ${label}. Hold it.`);

  const halfwayMs = Math.floor(total / 2) * 1000;
  const endMs = total * 1000;

  const halfway = setTimeout(async () => {
    const c = await getChannel(client, channelId);
    if (c) await c.send('Halfway. Keep going.').catch(() => {});
  }, halfwayMs);

  const end = setTimeout(async () => {
    activeTimers.delete(userId);
    const c = await getChannel(client, channelId);
    if (!c) return;
    if (extra > 0) {
      pushPending.set(userId, { extraSeconds: extra, exerciseName, channelId });
      await c
        .send(
          `Time. That was actually **${total}s** — I added ${extra}s on you. Did you hold it? (reply yes or no)`
        )
        .catch(() => {});
    } else {
      await c.send('Time. Rest.').catch(() => {});
    }
  }, endMs);

  activeTimers.set(userId, { halfway, end });
}
