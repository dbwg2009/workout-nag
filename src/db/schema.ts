import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex
} from 'drizzle-orm/pg-core';

export const dayStatus = pgEnum('day_status', [
  'pending',
  'proven',
  'rest',
  'overridden',
  'missed'
]);

export const overrideKind = pgEnum('override_kind', ['rest', 'sick', 'exam', 'snooze']);

export const proofKind = pgEnum('proof_kind', ['photo', 'tracker']);

/** One row per calendar day (local date string YYYY-MM-DD). */
export const days = pgTable(
  'days',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    isTrainingDay: boolean('is_training_day').notNull().default(false),
    sessionName: text('session_name'),
    status: dayStatus('status').notNull().default('pending'),
    provenAt: timestamp('proven_at', { withTimezone: true }),
    nagCount: integer('nag_count').notNull().default(0),
    escalation: integer('escalation').notNull().default(0),
    lastNagAt: timestamp('last_nag_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ dateUnique: uniqueIndex('days_date_unique').on(t.date) })
);

/** Active or historical pauses on nagging. */
export const overrides = pgTable('overrides', {
  id: serial('id').primaryKey(),
  kind: overrideKind('kind').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** Log of every nag sent, for the dashboard. */
export const nudges = pgTable('nudges', {
  id: serial('id').primaryKey(),
  dayId: integer('day_id').references(() => days.id),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  escalation: integer('escalation').notNull().default(0),
  channel: text('channel').notNull().default('discord'),
  message: text('message').notNull()
});

/**
 * Accepted proof records. We store the HASH only (verify-then-discard),
 * never the image itself — keeps your photos out of the database and
 * still lets us reject re-used images.
 */
export const proofs = pgTable(
  'proofs',
  {
    id: serial('id').primaryKey(),
    dayId: integer('day_id').references(() => days.id),
    kind: proofKind('kind').notNull(),
    hash: text('hash').notNull(),
    exifTakenAt: timestamp('exif_taken_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ hashUnique: uniqueIndex('proofs_hash_unique').on(t.hash) })
);

/** Workout log entries captured from chat ("LOG 4x12 press-ups, felt strong"). */
export const workouts = pgTable('workouts', {
  id: serial('id').primaryKey(),
  dayId: integer('day_id').references(() => days.id),
  date: date('date').notNull(),
  rawText: text('raw_text').notNull(),
  parsed: jsonb('parsed').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** Single-row settings table (id is always 1). */
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  wakeStart: text('wake_start').notNull().default('09:00'),
  wakeEnd: text('wake_end').notNull().default('21:00'),
  trainingDays: jsonb('training_days').notNull().default(['tue', 'thu', 'fri', 'sat']),
  maxNagsPerDay: integer('max_nags_per_day').notNull().default(6),
  tz: text('tz').notNull().default('Europe/London'),
  model: text('model').notNull().default('meta-llama/llama-3.3-70b-instruct:free'),
  personaName: text('persona_name').notNull().default('Sarge')
});

export type Day = typeof days.$inferSelect;
export type NewDay = typeof days.$inferInsert;
export type Override = typeof overrides.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Proof = typeof proofs.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
