# Setup — the bits only you can do

Two credentials can't be created for you: your **Discord bot** and your **OpenRouter key**. Here's the click-by-click. ~10 minutes.

## 1. Create the Discord bot

1. Go to **https://discord.com/developers/applications** → **New Application** → name it (e.g. "Sarge").
2. Left sidebar → **Bot** → **Reset Token** → copy it. This is your `DISCORD_TOKEN`. *(Keep it secret — anyone with it controls the bot.)*
3. On the same **Bot** page, scroll to **Privileged Gateway Intents** and turn ON **Message Content Intent**. Save. *(Sarge needs this to read your photo + commands.)*
4. Left sidebar → **OAuth2** → **URL Generator**:
   - Scopes: tick **bot**
   - Bot Permissions: tick **Send Messages**, **Read Message History**, **Attach Files**
   - Copy the generated URL at the bottom, open it, and **add the bot to a server you own**. (Make a private server just for this if you like: Discord → + → Create My Own.)

## 2. Get the IDs

Enable Developer Mode first: Discord **Settings → Advanced → Developer Mode** (on).

- **Your user ID** (`DISCORD_USER_ID`): right-click your own name → **Copy User ID**.
- **Channel ID** (`DISCORD_CHANNEL_ID`, optional): right-click the channel you want Sarge to nag you in → **Copy Channel ID**.
  - Leave this blank to have Sarge **DM** you instead. (DMs require you to share a server with the bot — which you do after step 1.4.)

## 3. OpenRouter key (optional but nicer)

1. **https://openrouter.ai** → sign in → **Keys** → create a key → it's your `OPENROUTER_API_KEY`.
2. The default model `meta-llama/llama-3.3-70b-instruct:free` is free. Leave the key blank entirely and Sarge uses built-in static nags instead — still fully works.

## 4. Configure + run

```bash
cp .env.example .env
# edit .env and paste in DISCORD_TOKEN, DISCORD_USER_ID, (DISCORD_CHANNEL_ID), (OPENROUTER_API_KEY)
docker compose up -d --build
```

Check it came up:

```bash
docker compose logs -f worker
# you want: "[ready] Sarge online as <name> ... Training days: tue, thu, fri, sat"
```

Dashboard: **http://localhost:3000**

## 5. Use it

- On a training day, when you've trained, **drop a photo or fitness-tracker screenshot** into the bot's DM/channel. It verifies and logs it; nags stop for the day.
- Need a break? `REST`, `SICK 3`, `EXAM 2026-06-15`, or `SNOOZE 2`.
- `STATUS` anytime to see your streak.

## Your profile (what Sarge knows about you)

Your training profile lives in `data/profile.local.json` (gitignored — never pushed to the public repo). It's pre-filled with your stats, goals and constraints. Edit it anytime to update what Sarge uses when coaching you — e.g. new body-comp numbers or a new pull-up max. The committed `data/profile.example.json` is just a blank template.

## Talking to Sarge

Beyond proof + commands, just message him:
- "what's today's session?" / "what's the Friday workout?"
- "how do I do a hollow body hold?" / "can I swap Bulgarian split squats?"
- "how's my streak?" / "am I progressing?"
- `LOG 4x12 press-ups, 8 pull-ups, 60s plank` to record a session (or just say "did 4x12 press-ups").

Chat needs `OPENROUTER_API_KEY`; commands and logging work without it.

## The training website

Open **`http://localhost:3000/plan`** for the full interactive 8-week plan. Tick off exercises, log reps/weight, watch the charts — it's all saved on the server, so it follows you across devices, and Sarge can see what you log.

The site is locked behind a PIN keypad. The default is **2911** (`SITE_PIN` in `.env`). Tap it on the on-screen keypad — no typing. To turn the lock off, blank out `SITE_PIN` or `SITE_AUTH_TOKEN`. For anything reachable from the internet, change `SITE_AUTH_TOKEN` to a long random string (`openssl rand -hex 32`) and keep the whole thing behind your own proxy — a 4-digit PIN is only a light gate.

## Tweaks (in `.env`)

- `TRAINING_DAYS=tue,thu,fri,sat` — your training days (from the 8-week plan).
- `WAKE_START` / `WAKE_END` — no nags outside these hours.
- `MAX_NAGS_PER_DAY` — start at 6; lower it if it's too much.
- `PERSONA_NAME` — rename Sarge if you want.

## Troubleshooting

- **Bot online but no DMs:** you must share a server with it (step 1.4), or set `DISCORD_CHANNEL_ID` to a channel it can post in.
- **"Can't reach the database" on the dashboard:** give the worker a few seconds to run migrations on first boot, then refresh.
- **Nags never come:** check it's actually a training day, you're inside `WAKE_START`–`WAKE_END`, and there's no active pause (`STATUS`).
