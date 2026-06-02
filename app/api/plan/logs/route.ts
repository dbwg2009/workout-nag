import { NextResponse } from 'next/server';
import { getPlanLogs, addPlanLog, clearPlanLogs } from '@/db/plan-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await getPlanLogs();
  const logs = rows.map((r) => ({
    id: r.id,
    date: r.date,
    session: r.session,
    pressups: r.pressups,
    pullups: r.pullups,
    squats: r.squats,
    plank: r.plank,
    weight: r.weight,
    notes: r.notes,
    ts: r.createdAt ? new Date(r.createdAt).getTime() : Date.now()
  }));
  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  try {
    const entry = await req.json();
    await addPlanLog(entry);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearPlanLogs();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
