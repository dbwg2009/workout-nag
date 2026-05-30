export interface StreakDay {
  dateStr: string;
  isTrainingDay: boolean;
  status: string;
}

/**
 * Consecutive training days proven, scanning back from the most recent.
 * rest/overridden days are skipped (neither break nor extend). 'missed' breaks
 * the streak. Today still 'pending' is ignored (in progress).
 */
export function computeStreak(days: StreakDay[]): number {
  const sorted = [...days].sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  let streak = 0;
  for (const d of sorted) {
    if (!d.isTrainingDay) continue;
    if (d.status === 'rest' || d.status === 'overridden') continue;
    if (d.status === 'proven') {
      streak++;
      continue;
    }
    if (d.status === 'missed') break;
    // 'pending' (today, in progress) — skip without breaking
  }
  return streak;
}
