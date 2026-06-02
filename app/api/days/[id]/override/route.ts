import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { days, overrides } from '@/db/schema';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dayId = parseInt(id, 10);
    const { kind, date } = await req.json() as { kind: 'rest' | 'sick' | 'exam' | 'overridden'; date: string };
    const db = getDb();

    const tz = process.env.TZ_DEFAULT || 'Europe/London';
    const startsAt = DateTime.fromISO(date, { zone: tz }).startOf('day').toJSDate();
    const endsAt = DateTime.fromISO(date, { zone: tz }).endOf('day').toJSDate();

    const overrideKind = kind === 'overridden' ? 'rest' : kind;
    await db.insert(overrides).values({ kind: overrideKind, startsAt, endsAt, reason: `web: ${kind}` });

    const newStatus = kind === 'rest' ? 'rest' : 'overridden';
    await db.update(days).set({ status: newStatus }).where(eq(days.id, dayId));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
