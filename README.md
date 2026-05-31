# 🪖 Sarge — Workout Accountability Bot

A self-hosted, **free** alternative to paid accountability apps (Overlord, BodyBuddy, etc.). Sarge nags you on your scheduled training days until you send proof you worked out, then logs your streak and goes quiet.

**Relentless, but fair.** He badgers you on a lazy day — but he has rest days, a no-guilt sick/exam override, and the moment you say you're ill, injured, or buried in revision he drops the act and tells you to rest. No money taken, no devices bricked, no body-shaming. Ever.

**He's also your coach.** Sarge knows your full 8-week programme and your profile, so you can talk to him about anything — today's session in detail, form tips, exercise swaps, how to progress, or how your streak's going — and log workouts just by messaging him.

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
| `LOG [what you did]` | Record a workout (e.g. `LOG 4x12 press-ups, 60s plank`) |
| *(just chat)* | Ask about your session, form, progress — Sarge answers as your coach |

If you just *type* that you're ill/injured/exhausted/overwhelmed, Sarge auto-pauses for the day and replies kindly — even without a command. And if you state a workout in passing ("did 4x12 press-ups"), he logs it automatically; ask a question ("should I do 4x12?") and he just answers.

### Coaching & chat

Send anything — "what's today?", "how do I do a pike press-up?", "can I swap lunges?", "how's my week looking?". Sarge replies in character using your live programme, stats, streak and recent logs as context. Training is his specialty; off-topic chat gets a short answer and a nudge back to work. Requires an `OPENROUTER_API_KEY` (without it, commands still work but free chat is disabled).

## Training website (`/plan`)

The full interactive 8-week plan runs at **`/plan`** in the same web app — tickable sessions, a date-aware "Today" view, the phase calendar, rest timer, nutrition cheat-sheet, and a rep/weight logger with charts. Your ticks and logs are saved **server-side in Postgres**, so they're remembered across every device (no more per-browser localStorage). Anything you log there also feeds Sarge's coaching.

The site is gated by an on-screen **PIN keypad** (no keyboard needed on mobile). Set `SITE_PIN` and `SITE_AUTH_TOKEN` in `.env` to enable it; leave either blank to disable. The PIN is enforced server-side (cookie + middleware), but a 4-digit PIN is a *light* gate — keep the site on your LAN or behind your own reverse proxy, and change `SITE_AUTH_TOKEN` for anything internet-facing.

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
  db/        Drizzle schema + client + plan-repo (ticks/logs store)
  core/      pure logic — schedule, escalation, overrides, proof, streak, concern, workoutlog (all unit-tested)
  nag/       drill-sergeant persona, nag generation, and the coach (chat with plan+profile+logs context)
  data/      the 8-week plan (committed) + profile loader (reads your private profile)
worker/      the bot: config, repo, discord client/handlers, cron entrypoint
app/         Next.js — dashboard (/), training site (/plan), PIN keypad (/lock), API routes
middleware.ts  PIN gate for all routes
public/      plan-app.html (the training site, server-backed)
data/        profile.example.json (committed) + profile.local.json (gitignored, your stats)
test/        unit tests (run with `npm test`)
drizzle/     generated SQL migrations
```

### Your profile (private)

Sarge's coaching uses `data/profile.local.json` — your stats, goals, baselines and constraints. **It's gitignored and never pushed**, since this repo is public. A blank `data/profile.example.json` is committed as the template; edit your local copy anytime to update what Sarge knows.

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
