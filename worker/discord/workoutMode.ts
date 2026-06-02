import type { Client, SendableChannels } from 'discord.js';
import { WARMUP, detailedSession } from '../../src/data/plan';
import { MICRO_EXERCISES } from '../../src/data/timerData';
import { localNow } from '../../src/core/time';
import { isTrainingDay, sessionFor, weekNumber } from '../../src/core/schedule';
import type { Config } from '../config';
import * as repo from '../repo';
import { addPlanLog } from '../../src/db/plan-repo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseStep {
  name: string;
  setsDisplay: string;
  totalSets: number;
  isTimed: boolean;
  timedSeconds: number;
  repsLogged: (number | null)[];
}

type SessionPhase = 'warmup' | 'set-prompt' | 'set-reps' | 'timer-active' | 'resting' | 'done';

interface WorkoutSession {
  userId: string;
  channelId: string;
  client: Client;
  cfg: Config;
  sessionLabel: string;
  sessionNote: string;
  exercises: ExerciseStep[];
  exIdx: number;
  setIdx: number;
  phase: SessionPhase;
  promptMsgId: string | null;
  timerHandles: ReturnType<typeof setTimeout>[];
  lastActivity: number;
  photoAfterExIdx: number;
  photoDone: boolean;
  isMicro: boolean;
  microSession: 'morning' | 'evening' | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getChannel(client: Client, channelId: string): Promise<SendableChannels | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    return ch && ch.isSendable() ? ch : null;
  } catch { return null; }
}

function parseSetsCount(s: string): number {
  const m = s.match(/^(\d+)\s*[×x]/);
  return m ? parseInt(m[1], 10) : 1;
}

function parseTimedSeconds(s: string): number | null {
  const m = s.match(/(\d+)\s*sec/i);
  return m ? parseInt(m[1], 10) : null;
}

function restFor(exerciseName: string): number {
  return /pull.?up|chin.?up|negative/i.test(exerciseName) ? 90 : 60;
}

function clearTimers(session: WorkoutSession): void {
  session.timerHandles.forEach(clearTimeout);
  session.timerHandles = [];
}

// ── Inline timers ──────────────────────────────────────────────────────────────

async function runRest(
  session: WorkoutSession,
  seconds: number,
  onDone: () => Promise<void>
): Promise<void> {
  const ch = await getChannel(session.client, session.channelId);
  if (!ch) { await onDone(); return; }

  session.phase = 'resting';
  clearTimers(session);

  const msg = await ch.send(`**Resting — ${seconds}s**`).catch(() => null);
  const countdownStart = (seconds - 5) * 1000;
  for (let n = 5; n >= 1; n--) {
    const delay = countdownStart + (5 - n) * 1000;
    session.timerHandles.push(
      setTimeout(() => void msg?.edit(`**${n}**`).catch(() => {}), delay)
    );
  }
  session.timerHandles.push(
    setTimeout(() => void onDone(), seconds * 1000)
  );
}

async function runTimedSet(
  session: WorkoutSession,
  seconds: number,
  onDone: () => Promise<void>
): Promise<void> {
  const ch = await getChannel(session.client, session.channelId);
  if (!ch) { await onDone(); return; }

  session.phase = 'timer-active';
  clearTimers(session);

  const label = `${seconds}s`;
  const ex = session.exercises[session.exIdx];
  const msg = await ch.send('**5**').catch(() => null);

  for (let n = 4; n >= 1; n--) {
    const delay = (5 - n) * 1000;
    session.timerHandles.push(
      setTimeout(() => void msg?.edit(`**${n}**`).catch(() => {}), delay)
    );
  }
  session.timerHandles.push(
    setTimeout(
      () => void msg?.edit(`**GO.** ${ex.name} — ${label}. Hold it.`).catch(() => {}),
      5000
    )
  );

  const halfMs = 5000 + Math.floor(seconds / 2) * 1000;
  session.timerHandles.push(
    setTimeout(async () => {
      const c = await getChannel(session.client, session.channelId);
      if (c) await c.send('Halfway. Keep going.').catch(() => {});
    }, halfMs)
  );

  session.timerHandles.push(
    setTimeout(async () => {
      const c = await getChannel(session.client, session.channelId);
      if (c) await c.send('Time.').catch(() => {});
      await onDone();
    }, 5000 + seconds * 1000)
  );
}

// ── Session flow ──────────────────────────────────────────────────────────────

export const activeSessions = new Map<string, WorkoutSession>();

async function advance(session: WorkoutSession): Promise<void> {
  session.lastActivity = Date.now();

  // Advance past completed sets of current exercise
  while (
    session.exIdx < session.exercises.length &&
    session.setIdx >= session.exercises[session.exIdx].totalSets
  ) {
    session.setIdx = 0;
    session.exIdx++;
  }

  if (session.exIdx >= session.exercises.length) {
    await finishSession(session);
    return;
  }

  const ch = await getChannel(session.client, session.channelId);
  if (!ch) return;

  const ex = session.exercises[session.exIdx];
  const totalEx = session.exercises.length;
  const isFirstSet = session.setIdx === 0;

  // Photo prompt at the designated exercise (first set of that exercise)
  if (!session.photoDone && session.exIdx === session.photoAfterExIdx && isFirstSet) {
    session.photoDone = true;
    await ch
      .send('📸 **Quick — send a photo.** Gym shot or fitness screenshot. Proof for today.')
      .catch(() => {});
  }

  let header = '';
  if (isFirstSet) {
    header = `**${session.exIdx + 1}/${totalEx} — ${ex.name}**\n`;
  }

  const setLabel = `Set ${session.setIdx + 1}/${ex.totalSets}`;
  const detail = ex.setsDisplay ? `*${ex.setsDisplay}*` : '';

  if (ex.isTimed) {
    const content = [header, `**${setLabel}** ${detail}`, '', 'React ✅ when ready.']
      .filter(Boolean)
      .join('\n');
    const msg = await ch.send(content).catch(() => null);
    if (msg) {
      session.phase = 'set-prompt';
      session.promptMsgId = msg.id;
      await msg.react('✅').catch(() => {});
    }
  } else {
    const content = [header, `**${setLabel}** ${detail}`, '', 'React ✅ when done.']
      .filter(Boolean)
      .join('\n');
    const msg = await ch.send(content).catch(() => null);
    if (msg) {
      session.phase = 'set-prompt';
      session.promptMsgId = msg.id;
      await msg.react('✅').catch(() => {});
    }
  }
}

async function afterSetDone(session: WorkoutSession): Promise<void> {
  const ex = session.exercises[session.exIdx];
  session.setIdx++;

  const isLastSetOfExercise = session.setIdx >= ex.totalSets;
  const isLastExercise = session.exIdx >= session.exercises.length - 1;

  if (isLastSetOfExercise && isLastExercise) {
    await finishSession(session);
  } else {
    await runRest(session, restFor(ex.name), () => advance(session));
  }
}

async function finishSession(session: WorkoutSession): Promise<void> {
  session.phase = 'done';
  clearTimers(session);
  activeSessions.delete(session.userId);

  const ch = await getChannel(session.client, session.channelId);
  if (!ch) return;

  const lines: string[] = [`✅ **${session.sessionLabel} — complete.**`];
  lines.push('');
  for (const ex of session.exercises) {
    const reps = ex.repsLogged.filter((r) => r !== null) as number[];
    if (ex.isTimed) {
      lines.push(`• ${ex.name} — ${ex.totalSets}×${ex.timedSeconds}s`);
    } else if (reps.length > 0) {
      lines.push(`• ${ex.name} — ${reps.join(', ')} reps`);
    } else {
      lines.push(`• ${ex.name} — ${ex.totalSets} set${ex.totalSets > 1 ? 's' : ''}`);
    }
  }

  const now = new Date();
  const ln = localNow(session.cfg.tz, now);
  const training = isTrainingDay(ln.weekday, session.cfg.trainingDays);
  const sessionName = sessionFor(ln.weekday, session.cfg.trainingDays);
  const day = await repo.ensureToday(ln.dateStr, training, sessionName);

  if (session.isMicro) {
    lines.push('');
    lines.push('Good. Marked done.');
    if (session.microSession === 'morning' && !day.microDone) {
      await repo.markMicroDone(day.id);
    } else if (session.microSession === 'evening' && !day.microEveningDone) {
      await repo.markMicroEveningDone(day.id);
    }
  } else {
    // Map exercise results into structured plan_logs fields
    const pressupNames = /press.?up|push.?up/i;
    const pullupNames = /pull.?up|chin.?up|negative/i;
    const squatNames = /squat|lunge|glute bridge|calf/i;
    const plankNames = /plank/i;

    const collect = (pattern: RegExp): string | undefined => {
      const parts = session.exercises
        .filter((ex) => pattern.test(ex.name))
        .map((ex) => {
          const reps = ex.repsLogged.filter((r) => r !== null) as number[];
          if (ex.isTimed) return `${ex.name} ${ex.totalSets}×${ex.timedSeconds}s`;
          if (reps.length > 0) return `${ex.name} ${reps.join('/')}`;
          return `${ex.name} ${ex.totalSets} sets`;
        });
      return parts.length ? parts.join('; ') : undefined;
    };

    const noteExercises = session.exercises
      .filter((ex) => !pressupNames.test(ex.name) && !pullupNames.test(ex.name) && !squatNames.test(ex.name) && !plankNames.test(ex.name))
      .map((ex) => {
        const reps = ex.repsLogged.filter((r) => r !== null) as number[];
        if (ex.isTimed) return `${ex.name} ${ex.totalSets}×${ex.timedSeconds}s`;
        if (reps.length > 0) return `${ex.name} ${reps.join('/')}`;
        return `${ex.name} ${ex.totalSets} sets`;
      });

    await addPlanLog({
      date: ln.dateStr,
      session: session.sessionLabel,
      pressups: collect(pressupNames),
      pullups: collect(pullupNames),
      squats: collect(squatNames),
      plank: collect(plankNames),
      notes: noteExercises.length ? noteExercises.join('; ') : undefined
    });
    lines.push('');
    lines.push('Logged to training plan. Send a photo for proof, or `/log` to add notes.');
  }

  await ch.send(lines.join('\n')).catch(() => {});
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function startWorkout(
  client: Client,
  cfg: Config,
  userId: string,
  channelId: string
): Promise<void> {
  const now = new Date();
  const ln = localNow(cfg.tz, now);
  const training = isTrainingDay(ln.weekday, cfg.trainingDays);
  const week = weekNumber(ln.dateStr, cfg.planStart);

  const ch = await getChannel(client, channelId);
  if (!ch) return;

  // Existing session?
  const existing = activeSessions.get(userId);
  if (existing && existing.phase !== 'done') {
    const msg = await ch
      .send('You already have an active session. React ✅ to resume or 🔄 to restart.')
      .catch(() => null);
    if (msg) {
      await msg.react('✅').catch(() => {});
      await msg.react('🔄').catch(() => {});
      // Store the message ID temporarily so we can handle the reaction
      existing.promptMsgId = msg.id;
      existing.phase = 'set-prompt'; // repurpose to handle the choice
      // Actually this is complex — let me use a separate flag
      // For simplicity: store a pending "resume-or-restart" state
      (existing as WorkoutSession & { pendingChoice?: string }).pendingChoice = 'resume-or-restart';
    }
    return;
  }

  // Determine what to run
  const session = await createSession(client, cfg, userId, channelId, ln, training, week, now);
  if (!session) return;

  activeSessions.set(userId, session);

  if (session.isMicro) {
    await beginMicro(session);
  } else {
    await beginWorkout(session);
  }
}

async function createSession(
  client: Client,
  cfg: Config,
  userId: string,
  channelId: string,
  ln: ReturnType<typeof localNow>,
  training: boolean,
  week: number | null,
  now: Date
): Promise<WorkoutSession | null> {
  const ch = await getChannel(client, channelId);
  if (!ch) return null;

  const isMicro = !training;
  let microSession: 'morning' | 'evening' | null = null;
  let exercises: ExerciseStep[] = [];
  let sessionLabel = '';
  let sessionNote = '';

  if (isMicro) {
    // Pick which micro session hasn't been done yet
    const day = await repo.ensureToday(ln.dateStr, false, null);
    const hour = ln.hour;

    if (!day.microDone && hour < 13) {
      microSession = 'morning';
    } else if (!day.microEveningDone) {
      microSession = 'evening';
    } else if (!day.microDone) {
      microSession = 'morning';
    } else {
      await ch.send('Both micro sessions already done today. Good work.').catch(() => {});
      return null;
    }

    const microExercises = MICRO_EXERCISES.filter(
      (e) => e.session === microSession || e.session === 'both'
    );
    sessionLabel = `${microSession === 'morning' ? 'Morning' : 'Evening'} micro`;
    sessionNote = '';
    exercises = microExercises.map((e) => ({
      name: e.name,
      setsDisplay: `${e.seconds}s`,
      totalSets: 1,
      isTimed: true,
      timedSeconds: e.seconds,
      repsLogged: [null]
    }));
  } else {
    const planSession = detailedSession(ln.weekday, week);
    if (!planSession) {
      await ch
        .send(`No session found for today (${ln.weekday}). Check the plan or use a specific day.`)
        .catch(() => {});
      return null;
    }
    sessionLabel = planSession.label;
    sessionNote = planSession.note;
    exercises = planSession.exercises.map((e) => {
      const timedSecs = parseTimedSeconds(e.sets);
      return {
        name: e.name,
        setsDisplay: e.sets,
        totalSets: parseSetsCount(e.sets),
        isTimed: timedSecs !== null,
        timedSeconds: timedSecs ?? 0,
        repsLogged: []
      };
    });
  }

  // Pick a random exercise index (not first, not last) for the photo prompt
  const photoAfterExIdx =
    exercises.length > 2
      ? 1 + Math.floor(Math.random() * (exercises.length - 2))
      : 0;

  return {
    userId,
    channelId,
    client,
    cfg,
    sessionLabel,
    sessionNote,
    exercises,
    exIdx: 0,
    setIdx: 0,
    phase: 'warmup',
    promptMsgId: null,
    timerHandles: [],
    lastActivity: Date.now(),
    photoAfterExIdx,
    photoDone: false,
    isMicro,
    microSession
  };
}

async function beginWorkout(session: WorkoutSession): Promise<void> {
  const ch = await getChannel(session.client, session.channelId);
  if (!ch) return;

  const warmupLines = ['**Warmup — do these first:**', ''];
  WARMUP.forEach((w, i) => warmupLines.push(`${i + 1}. ${w}`));
  warmupLines.push('');
  warmupLines.push(`Then: **${session.sessionLabel}**`);
  if (session.sessionNote) warmupLines.push(`*${session.sessionNote}*`);
  warmupLines.push('');
  warmupLines.push('React ✅ when warmup is done.');

  const msg = await ch.send(warmupLines.join('\n')).catch(() => null);
  if (msg) {
    session.phase = 'warmup';
    session.promptMsgId = msg.id;
    await msg.react('✅').catch(() => {});
  }
}

async function beginMicro(session: WorkoutSession): Promise<void> {
  const ch = await getChannel(session.client, session.channelId);
  if (!ch) return;

  const lines = [
    `**${session.sessionLabel} — ${session.exercises.length} exercises**`,
    '',
    session.exercises.map((e, i) => `${i + 1}. ${e.name} (${e.timedSeconds}s)`).join('\n'),
    '',
    'React ✅ to start.'
  ];

  const msg = await ch.send(lines.join('\n')).catch(() => null);
  if (msg) {
    session.phase = 'warmup';
    session.promptMsgId = msg.id;
    await msg.react('✅').catch(() => {});
  }
}

export async function handleWorkoutReaction(
  userId: string,
  msgId: string,
  emoji: string
): Promise<void> {
  const session = activeSessions.get(userId) as (WorkoutSession & { pendingChoice?: string }) | undefined;
  if (!session || msgId !== session.promptMsgId) return;

  session.lastActivity = Date.now();

  // Resume-or-restart choice
  if (session.pendingChoice === 'resume-or-restart') {
    delete session.pendingChoice;
    if (emoji === '✅') {
      // Resume: re-show current step
      session.promptMsgId = null;
      await advance(session);
    } else if (emoji === '🔄') {
      // Restart: rebuild and start fresh
      const now = new Date();
      const ln = localNow(session.cfg.tz, now);
      const training = isTrainingDay(ln.weekday, session.cfg.trainingDays);
      const week = weekNumber(ln.dateStr, session.cfg.planStart);
      clearTimers(session);
      activeSessions.delete(userId);
      const fresh = await createSession(session.client, session.cfg, userId, session.channelId, ln, training, week, now);
      if (!fresh) return;
      activeSessions.set(userId, fresh);
      if (fresh.isMicro) await beginMicro(fresh);
      else await beginWorkout(fresh);
    }
    return;
  }

  if (emoji !== '✅') return;

  if (session.phase === 'warmup') {
    session.promptMsgId = null;
    await advance(session);
    return;
  }

  if (session.phase === 'set-prompt') {
    const ex = session.exercises[session.exIdx];
    session.promptMsgId = null;

    if (ex.isTimed) {
      await runTimedSet(session, ex.timedSeconds, async () => {
        ex.repsLogged[session.setIdx] = null;
        await afterSetDone(session);
      });
    } else {
      session.phase = 'set-reps';
      const ch = await getChannel(session.client, session.channelId);
      if (ch) await ch.send('How many reps?').catch(() => {});
    }
  }
}

export async function handleWorkoutMessage(userId: string, text: string): Promise<boolean> {
  const session = activeSessions.get(userId);
  if (!session || session.phase !== 'set-reps') return false;

  session.lastActivity = Date.now();
  const reps = parseInt(text.trim(), 10);

  if (isNaN(reps) || reps <= 0) {
    const ch = await getChannel(session.client, session.channelId);
    if (ch) await ch.send('Just the number — how many reps?').catch(() => {});
    return true;
  }

  const ex = session.exercises[session.exIdx];
  ex.repsLogged[session.setIdx] = reps;
  await afterSetDone(session);
  return true;
}

export async function cancelWorkout(userId: string, client: Client, channelId: string): Promise<void> {
  const session = activeSessions.get(userId);
  if (!session) {
    const ch = await getChannel(client, channelId);
    if (ch) await ch.send('No active session.').catch(() => {});
    return;
  }
  clearTimers(session);
  activeSessions.delete(userId);
  const ch = await getChannel(client, channelId);
  if (ch) await ch.send('Session cancelled.').catch(() => {});
}
