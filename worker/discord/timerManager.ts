import type { Client, SendableChannels } from 'discord.js';
import { shouldPush, pushSeconds } from '../../src/core/timer';

export interface PushPending {
  extraSeconds: number;
  exerciseName: string;
  channelId: string;
}

const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
export const pushPending = new Map<string, PushPending>();

async function getChannel(client: Client, channelId: string): Promise<SendableChannels | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    return ch && ch.isSendable() ? ch : null;
  } catch {
    return null;
  }
}

export function cancelTimer(userId: string): void {
  const timeouts = activeTimers.get(userId);
  if (timeouts) {
    timeouts.forEach(clearTimeout);
    activeTimers.delete(userId);
  }
  pushPending.delete(userId);
}

export async function startTimer(opts: {
  client: Client;
  channelId: string;
  userId: string;
  exerciseName: string;
  seconds: number;
  pushEnabled: boolean;
  maxPushSeconds: number;
  isRest?: boolean;
}): Promise<void> {
  const { client, channelId, userId, exerciseName, seconds, pushEnabled, maxPushSeconds, isRest } = opts;

  cancelTimer(userId);

  // Never apply push to rest timers — the "did you hold it?" prompt makes no sense for rest.
  const extra = (!isRest && shouldPush(pushEnabled)) ? pushSeconds(maxPushSeconds) : 0;
  const total = seconds + extra;

  const ch = await getChannel(client, channelId);
  if (!ch) return;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const label = mins > 0 ? `${mins}m ${secs > 0 ? secs + 's' : ''}`.trim() : `${seconds}s`;

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  activeTimers.set(userId, timeouts);

  if (isRest) {
    // Rest timer: starts immediately, silent until last 5 seconds, no end message.
    const msg = await ch.send(`**Resting — ${label}**`).catch(() => null);
    const countdownOffsetMs = total * 1000 - 5000;

    for (let n = 5; n >= 1; n--) {
      const delay = countdownOffsetMs + (5 - n) * 1000;
      timeouts.push(setTimeout(() => void msg?.edit(`**${n}**`).catch(() => {}), delay));
    }

    timeouts.push(setTimeout(() => { activeTimers.delete(userId); }, total * 1000));
  } else {
    // Exercise timer: 5-second countdown then GO, halfway nudge, end prompt.
    const msg = await ch.send('**5**').catch(() => null);
    for (let n = 4; n >= 1; n--) {
      const delay = (5 - n) * 1000;
      timeouts.push(setTimeout(() => void msg?.edit(`**${n}**`).catch(() => {}), delay));
    }
    timeouts.push(
      setTimeout(() => void msg?.edit(`**GO.** ${exerciseName} — ${label}. Hold it.`).catch(() => {}), 5000)
    );

    const halfwayMs = 5000 + Math.floor(total / 2) * 1000;
    const endMs = 5000 + total * 1000;

    timeouts.push(
      setTimeout(async () => {
        const c = await getChannel(client, channelId);
        if (c) await c.send('Halfway. Keep going.').catch(() => {});
      }, halfwayMs)
    );

    timeouts.push(
      setTimeout(async () => {
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
          await c.send('Time.').catch(() => {});
        }
      }, endMs)
    );
  }
}
