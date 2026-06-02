import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { days } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dayId = parseInt(id, 10);
    const { session } = await req.json() as { session: 'morning' | 'evening' };
    const db = getDb();

    if (session === 'morning') {
      await db.update(days).set({ microDone: true }).where(eq(days.id, dayId));
    } else {
      await db.update(days).set({ microEveningDone: true }).where(eq(days.id, dayId));
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
