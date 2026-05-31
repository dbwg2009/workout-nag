import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached: string | null = null;

export function GET() {
  try {
    if (!cached) cached = readFileSync(join(process.cwd(), 'public', 'plan-app.html'), 'utf8');
    return new Response(cached, {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  } catch {
    return new Response('Plan page not found.', { status: 500 });
  }
}
