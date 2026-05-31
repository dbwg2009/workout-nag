'use client';

import { useState, useEffect, useCallback } from 'react';

export default function Lock() {
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('/');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('from');
    if (p) setFrom(p);
  }, []);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: code })
        });
        if (r.ok) {
          window.location.href = from || '/';
          return;
        }
      } catch {
        /* ignore */
      }
      setErr(true);
      setEntry('');
      setBusy(false);
    },
    [from]
  );

  useEffect(() => {
    if (entry.length === 4 && !busy) submit(entry);
  }, [entry, busy, submit]);

  const press = (d: string) => {
    if (busy) return;
    setErr(false);
    setEntry((e) => (e.length < 8 ? e + d : e));
  };
  const back = () => {
    setErr(false);
    setEntry((e) => e.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.title}>SARGE</div>
        <div style={S.sub}>Enter PIN</div>
        <div style={S.dots}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                ...S.dot,
                background: i < entry.length ? '#e85a2a' : 'transparent',
                borderColor: err ? '#e0533d' : '#444'
              }}
            />
          ))}
        </div>
        <div style={{ ...S.err, opacity: err ? 1 : 0 }}>Wrong PIN — try again</div>
        <div style={S.pad}>
          {keys.map((k) => (
            <button key={k} style={S.key} onClick={() => press(k)} disabled={busy}>
              {k}
            </button>
          ))}
          <span />
          <button style={S.key} onClick={() => press('0')} disabled={busy}>
            0
          </button>
          <button style={{ ...S.key, ...S.keyAlt }} onClick={back} disabled={busy}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#080808',
    color: '#e8e4df',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '1.5rem'
  },
  card: { width: '100%', maxWidth: 320, textAlign: 'center' },
  title: {
    fontSize: '2rem',
    letterSpacing: '0.3em',
    fontWeight: 700,
    color: '#e85a2a',
    marginBottom: '0.25rem'
  },
  sub: { fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888' },
  dots: { display: 'flex', gap: '1rem', justifyContent: 'center', margin: '1.75rem 0 0.5rem' },
  dot: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #444', display: 'inline-block' },
  err: { fontSize: '0.75rem', color: '#e0533d', height: '1rem', transition: 'opacity 0.2s' },
  pad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.9rem',
    marginTop: '1.25rem'
  },
  key: {
    aspectRatio: '1 / 1',
    fontSize: '1.6rem',
    fontWeight: 300,
    color: '#e8e4df',
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: '50%',
    cursor: 'pointer'
  },
  keyAlt: { fontSize: '1.2rem', color: '#888' }
};
