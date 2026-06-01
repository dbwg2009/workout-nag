import { DateTime } from 'luxon';

export interface OverrideRow {
  kind: string;
  startsAt: Date;
  endsAt: Date;
}

export function isOverrideActive(overrides: OverrideRow[], now: Date): boolean {
  return overrides.some((o) => now >= o.startsAt && now < o.endsAt);
}

export type ParsedCommand =
  | { type: 'rest' }
  | { type: 'sick'; days: number }
  | { type: 'exam'; until: string | null }
  | { type: 'snooze'; hours: number }
  | { type: 'status' }
  | { type: 'log'; text: string }
  | null;

/** Parse a slash command from a user message (e.g. /rest, /sick 3, /log ...). */
export function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  if (!text.startsWith('/')) return null;
  const lower = text.toLowerCase();
  const first = lower.split(/\s+/)[0].slice(1); // strip leading /

  if (first === 'rest') return { type: 'rest' };
  if (first === 'status') return { type: 'status' };
  if (first === 'log') return { type: 'log', text: text.replace(/^\/log\s*/i, '').trim() };
  if (first === 'sick' || first === 'ill') {
    const m = lower.match(/(\d+)/);
    return { type: 'sick', days: m ? Math.max(1, Math.min(14, parseInt(m[1], 10))) : 2 };
  }
  if (first === 'exam' || first === 'exams') {
    const m = lower.match(/(\d{4}-\d{2}-\d{2})/);
    return { type: 'exam', until: m ? m[1] : null };
  }
  if (first === 'snooze') {
    const m = lower.match(/(\d+)/);
    return { type: 'snooze', hours: m ? Math.max(1, Math.min(12, parseInt(m[1], 10))) : 2 };
  }
  return null;
}

export type WindowCommand = Exclude<ParsedCommand, null | { type: 'status' } | { type: 'log'; text: string }>;

/** Translate a command into a concrete [startsAt, endsAt] window in the given tz. */
export function overrideWindow(
  cmd: WindowCommand,
  tz: string,
  now: Date
): { startsAt: Date; endsAt: Date } {
  const start = DateTime.fromJSDate(now).setZone(tz);
  let end: DateTime;
  switch (cmd.type) {
    case 'rest':
      end = start.endOf('day');
      break;
    case 'sick':
      end = start.plus({ days: cmd.days });
      break;
    case 'exam':
      end = cmd.until
        ? DateTime.fromISO(cmd.until, { zone: tz }).endOf('day')
        : start.plus({ days: 7 });
      break;
    case 'snooze':
      end = start.plus({ hours: cmd.hours });
      break;
  }
  if (!end.isValid || end <= start) end = start.endOf('day');
  return { startsAt: start.toJSDate(), endsAt: end.toJSDate() };
}
