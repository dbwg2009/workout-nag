import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { planLogs } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    await db.delete(planLogs).where(eq(planLogs.id, parseInt(id, 10)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
