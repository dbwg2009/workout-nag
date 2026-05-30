export interface ParsedSet {
  exercise: string;
  sets?: number;
  reps?: number;
  seconds?: number;
}

/** Best-effort parse of a workout note. Raw text is always kept as source of truth. */
export function parseWorkout(text: string): ParsedSet[] {
  const t = text.replace(/^log\s+/i, '').trim();
  const entries: ParsedSet[] = [];

  // "4x12 press-ups", "3 x 8 pull ups"
  const setsReps = /(\d+)\s*[x×]\s*(\d+)\s+([a-z][a-z\- ]*?)(?=[,;.]|\sand\b|\d|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = setsReps.exec(t)) !== null) {
    entries.push({
      exercise: m[3].trim(),
      sets: parseInt(m[1], 10),
      reps: parseInt(m[2], 10)
    });
  }

  // "60s plank", "45 sec plank"
  const dur = /(\d+)\s*(?:s|sec|secs|seconds)\s+([a-z][a-z\- ]*?)(?=[,;.]|\sand\b|\d|$)/gi;
  while ((m = dur.exec(t)) !== null) {
    entries.push({ exercise: m[2].trim(), seconds: parseInt(m[1], 10) });
  }

  return entries;
}

export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.includes('?')) return true;
  return /^(what|how|should|can|why|when|is|are|do|does|could|would|will|which|where|who)\b/.test(t);
}

/** A statement (not a question) that contains at least one parsed set is a workout report. */
export function isWorkoutReport(text: string, parsed: ParsedSet[]): boolean {
  if (parsed.length === 0) return false;
  if (isQuestion(text)) return false;
  return true;
}
