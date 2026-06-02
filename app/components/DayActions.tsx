'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  dayId: number;
  date: string;
  isTrainingDay: boolean;
  status: string;
  microDone: boolean;
  microEveningDone: boolean;
}

export default function DayActions({ dayId, date, isTrainingDay, status, microDone, microEveningDone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canMicro = !microDone || !microEveningDone;
  const canOverride = isTrainingDay && status === 'pending';

  if (!canMicro && !canOverride) return null;

  async function markMicro(session: 'morning' | 'evening') {
    await fetch(`/api/days/${dayId}/micro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session })
    });
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function applyOverride(kind: 'rest' | 'sick' | 'exam') {
    await fetch(`/api/days/${dayId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, date })
    });
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          color: 'var(--text3)',
          fontSize: '0.65rem',
          padding: '0.15rem 0.45rem',
          cursor: 'pointer',
          letterSpacing: '0.08em'
        }}
      >
        •••
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            zIndex: 10,
            minWidth: 150,
            fontSize: '0.75rem'
          }}
        >
          {!microDone && (
            <button className="action-item" onClick={() => void markMicro('morning')}>
              ✓ Morning micro
            </button>
          )}
          {microDone && !microEveningDone && (
            <button className="action-item" onClick={() => void markMicro('evening')}>
              ✓ Evening micro
            </button>
          )}
          {canOverride && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
              <button className="action-item" onClick={() => void applyOverride('rest')}>Rest day</button>
              <button className="action-item" onClick={() => void applyOverride('sick')}>Sick</button>
              <button className="action-item" onClick={() => void applyOverride('exam')}>Exam</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
