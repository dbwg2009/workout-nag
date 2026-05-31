import { NextResponse } from 'next/server';
import { getTicks, setTicks } from '@/db/plan-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ticks = await getTicks();
  return NextResponse.json({ ticks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await setTicks(body?.ticks ?? {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
