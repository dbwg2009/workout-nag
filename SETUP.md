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

## Tweaks (in `.env`)

- `TRAINING_DAYS=tue,thu,fri,sat` — your training days (from the 8-week plan).
- `WAKE_START` / `WAKE_END` — no nags outside these hours.
- `MAX_NAGS_PER_DAY` — start at 6; lower it if it's too much.
- `PERSONA_NAME` — rename Sarge if you want.

## Troubleshooting

- **Bot online but no DMs:** you must share a server with it (step 1.4), or set `DISCORD_CHANNEL_ID` to a channel it can post in.
- **"Can't reach the database" on the dashboard:** give the worker a few seconds to run migrations on first boot, then refresh.
- **Nags never come:** check it's actually a training day, you're inside `WAKE_START`–`WAKE_END`, and there's no active pause (`STATUS`).
