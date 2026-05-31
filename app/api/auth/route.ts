import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let pin = '';
  try {
    const b = await req.json();
    pin = String(b?.pin ?? '');
  } catch {
    /* ignore */
  }
  const real = process.env.SITE_PIN;
  if (real && pin === real) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('site_auth', process.env.SITE_AUTH_TOKEN || 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });
    return res;
  }
  await new Promise((r) => setTimeout(r, 600)); // throttle brute force
  return NextResponse.json({ ok: false }, { status: 401 });
}
