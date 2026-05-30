import { Client } from 'discord.js';
import type { Config } from '../config';

/** Send a text message to the configured channel, or DM the user as fallback. */
export async function sendText(client: Client, cfg: Config, content: string): Promise<void> {
  try {
    if (cfg.channelId) {
      const channel = await client.channels.fetch(cfg.channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        await channel.send(content);
        return;
      }
    }
    const user = await client.users.fetch(cfg.userId);
    await user.send(content);
  } catch (err) {
    console.error('[send] failed to deliver message:', err);
  }
}
