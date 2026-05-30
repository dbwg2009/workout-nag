# 🪖 Sarge — Workout Accountability Bot

A self-hosted, **free** alternative to paid accountability apps (Overlord, BodyBuddy, etc.). Sarge nags you on your scheduled training days until you send proof you worked out, then logs your streak and goes quiet.

**Relentless, but fair.** He badgers you on a lazy day — but he has rest days, a no-guilt sick/exam override, and the moment you say you're ill, injured, or buried in revision he drops the act and tells you to rest. No money taken, no devices bricked, no body-shaming. Ever.

> Built for Discord. Runs in Docker on your own hardware. Costs ~£0.

---

## How it works

```
Scheduler (every 15 min, your timezone)
  → is today a training day? proven yet? paused?
  → if not: Sarge sends an escalating nag to your Discord
You reply with a photo / fitness screenshot
  → verified (fresh + not re-used) → streak++ → nags stop for the day
You reply REST / SICK / EXAM / SNOOZE
  → he backs off, kindly
```

- **Nagging** escalates through the day (easy-going → final push) but is capped (default 6/day) and silent overnight.
- **Proof** is a photo (gym, weights, rower, sweaty selfie) or a fitness-tracker screenshot. Verification is free: EXIF freshness + a content hash so an old image can't be re-used. *(No AI vision check — your choice; easy to add later.)*
- **Privacy:** proof images are **verified then discarded**. Only a hash + timestamp is stored, never your photos.

## Commands (DM the bot or post in its channel)

| Command | Effect |
|---|---|
| *(send a photo/screenshot)* | Logs today's workout as proven |
| `REST` | Skip today, no nags (recovery is training) |
| `SICK [days]` | Pause N days (default 2), supportively |
| `EXAM [yyyy-mm-dd]` | Exam-crunch mode — pause until a date (default 1 week) |
| `SNOOZE [hours]` | Back off for a few hours (default 2) |
| `STATUS` | Show streak, today's status, any active pause |

If you just *type* that you're ill/injured/exhausted/overwhelmed, Sarge auto-pauses for the day and replies kindly — even without a command.

## Quick start

You need a Discord bot token and (optionally) an OpenRouter key. **See [SETUP.md](./SETUP.md) for the click-by-click.**

```bash
cp .env.example .env     # then fill in DISCORD_TOKEN, DISCORD_USER_ID, etc.
docker compose up -d --build
```

The worker runs migrations automatically on first boot. Dashboard at `http://localhost:3000`.

Without an `OPENROUTER_API_KEY`, Sarge falls back to built-in static drill-sergeant lines — so it works out of the box; the key just makes the nags fresher.

## Tech

Next.js 15 (dashboard) · discord.js 14 (bot) · Postgres + Drizzle ORM · OpenRouter (`meta-llama/llama-3.3-70b-instruct:free` by default) · node-cron · Docker Compose. Mirrors the [Noted](https://github.com/dbwg2009/Noted) stack.

## Project structure

```
src/
  db/        Drizzle schema + client
  core/      pure logic — schedule, escalation, overrides, proof, streak, concern (all unit-tested)
  nag/       drill-sergeant persona + OpenRouter generation + safe deterministic replies
worker/      the bot: config, repo, discord client/handlers, cron entrypoint
app/         Next.js dashboard
test/        unit tests (run with `npm test`)
drizzle/     generated SQL migrations
```

## Dev commands

```bash
npm install
npm test            # 34 unit tests (logic + EXIF proof)
npm run typecheck   # tsc on both app + worker
npm run dev:worker  # run the bot locally (needs .env + a Postgres)
npm run dev:web     # run the dashboard locally
npm run db:generate # regenerate migrations after a schema change
```

## A note on the design

This is deliberately **not** the punishing kind of accountability bot. The override path is load-bearing: rest, illness, and exams are never punished, and the supportive replies are fixed text (never AI-generated) so they're always safe. Tune `MAX_NAGS_PER_DAY` and the persona to taste — but start gentler than you think.

## Licence

MIT © 2026 Daniel Grey
