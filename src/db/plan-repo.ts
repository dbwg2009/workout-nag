import { eq, desc } from 'drizzle-orm';
import { getDb } from './client';
import { planState, planLogs, type PlanLog } from './schema';

export async function getTicks(): Promise<Record<string, unknown>> {
  try {
    const db = getDb();
    const [row] = await db.select().from(planState).where(eq(planState.key, 'ticks'));
    return ((row?.value as Record<string, unknown>) ?? {});
  } catch {
    return {};
  }
}

export async function setTicks(value: unknown): Promise<void> {
  const db = getDb();
  await db
    .insert(planState)
    .values({ key: 'ticks', value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: planState.key,
      set: { value: value as object, updatedAt: new Date() }
    });
}

export async function getPlanLogs(limit = 500): Promise<PlanLog[]> {
  try {
    const db = getDb();
    return await db.select().from(planLogs).orderBy(desc(planLogs.createdAt)).limit(limit);
  } catch {
    return [];
  }
}

export interface PlanLogInput {
  date?: string;
  session?: string;
  pressups?: string;
  pullups?: string;
  squats?: string;
  plank?: string;
  weight?: string;
  notes?: string;
}

export async function addPlanLog(entry: PlanLogInput): Promise<void> {
  const db = getDb();
  await db.insert(planLogs).values({
    date: entry.date || new Date().toISOString().slice(0, 10),
    session: entry.session ?? null,
    pressups: entry.pressups ?? null,
    pullups: entry.pullups ?? null,
    squats: entry.squats ?? null,
    plank: entry.plank ?? null,
    weight: entry.weight ?? null,
    notes: entry.notes ?? null
  });
}

export async function clearPlanLogs(): Promise<void> {
  const db = getDb();
  await db.delete(planLogs);
}
