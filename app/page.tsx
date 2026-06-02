import { desc } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { days, nudges, overrides } from '@/db/schema';
import { computeStreak } from '@/core/streak';
import DayActions from './components/DayActions';

export const dynamic = 'force-dynamic';

type Loaded = {
  recentDays: (typeof days.$inferSelect)[];
  recentNudges: (typeof nudges.$inferSelect)[];
  activeOverrides: (typeof overrides.$inferSelect)[];
  ok: boolean;
};

async function load(): Promise<Loaded> {
  try {
    const db = getDb();
    const recentDays = await db.select().from(days).orderBy(desc(days.date)).limit(30);
    const recentNudges = await db.select().from(nudges).orderBy(desc(nudges.sentAt)).limit(10);
    const allOverrides = await db.select().from(overrides);
    const now = new Date();
    const activeOverrides = allOverrides.filter((o) => now >= o.startsAt && now < o.endsAt);
    return { recentDays, recentNudges, activeOverrides, ok: true };
  } catch {
    return { recentDays: [], recentNudges: [], activeOverrides: [], ok: false };
  }
}

export default async function Page() {
  const { recentDays, recentNudges, activeOverrides, ok } = await load();

  const streak = computeStreak(
    recentDays.map((d) => ({ dateStr: d.date, isTrainingDay: d.isTrainingDay, status: d.status }))
  );
  const proven = recentDays.filter((d) => d.status === 'proven').length;
  const missed = recentDays.filter((d) => d.status === 'missed').length;
  const today = recentDays[0];

  return (
    <div className="wrap">
      <div className="eyebrow">Accountability</div>
      <h1>Sarge</h1>
      <p className="muted">Relentless but fair. Proof or it didn&apos;t happen.</p>
      <p style={{ marginTop: '0.75rem' }}>
        <a href="/plan" style={{ color: '#e85a2a', fontWeight: 600 }}>
          → Open the 8-week training plan
        </a>
      </p>

      {!ok && (
        <div className="warn" style={{ marginTop: '1.5rem' }}>
          Can&apos;t reach the database yet. Run <code>npm run db:migrate</code> and make sure
          Postgres is up, then refresh.
        </div>
      )}

      <div className="grid cols-3">
        <div className="stat">
          <div className="n">{streak}</div>
          <div className="l">Day streak</div>
        </div>
        <div className="stat">
          <div className="n green">{proven}</div>
          <div className="l">Proven (30d)</div>
        </div>
        <div className="stat">
          <div className="n red">{missed}</div>
          <div className="l">Missed (30d)</div>
        </div>
      </div>

      <h2>Today</h2>
      <div className="card">
        {today ? (
          <div className="row">
            <span>{today.isTrainingDay ? today.sessionName ?? 'Training day' : 'Rest day'}</span>
            <span className={`pill ${today.status}`}>{today.status}</span>
          </div>
        ) : (
          <p className="muted">No data yet for today.</p>
        )}
        {activeOverrides.length > 0 && (
          <div className="row">
            <span>Active pause</span>
            <span className="pill">{activeOverrides.map((o) => o.kind).join(', ')}</span>
          </div>
        )}
      </div>

      <h2>Recent days</h2>
      <div className="card">
        {recentDays.length === 0 && <p className="muted">Nothing logged yet.</p>}
        {recentDays.slice(0, 14).map((d) => (
          <div className="row" key={d.id}>
            <span className="date">{d.date}</span>
            <span>{d.isTrainingDay ? d.sessionName : 'Rest'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`pill ${d.status}`}>{d.status}</span>
              <DayActions
                dayId={d.id}
                date={d.date}
                isTrainingDay={d.isTrainingDay}
                status={d.status}
                microDone={d.microDone}
                microEveningDone={d.microEveningDone}
              />
            </span>
          </div>
        ))}
      </div>

      <h2>Recent nags</h2>
      <div className="card">
        {recentNudges.length === 0 && <p className="muted">No nags sent yet.</p>}
        {recentNudges.map((n) => (
          <div className="nudge" key={n.id}>
            <span className="when">{new Date(n.sentAt).toLocaleString('en-GB')} · L{n.escalation}</span>
            <br />
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}
