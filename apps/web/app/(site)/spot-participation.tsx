'use client';

/**
 * Signed-in participation block for a spot detail page.
 *
 * Renders three sections for authenticated users:
 *   1. Community verification vote (Klopt / Klopt niet) with an optional
 *      geolocation proximity proof.
 *   2. A star-rating review form (1–5 stars + optional text body).
 *   3. A "Melden" (report) action.
 *
 * For signed-out visitors it shows a plain CTA linking to /signin.
 */

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@devrijehond/auth/client';

type SpotStatus = 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN' | 'REMOVED';

interface SpotParticipationProps {
  spotId: string;
  status: SpotStatus;
}

// ---------------------------------------------------------------------------
// Tiny inline icon helper (same pattern as spot-view.tsx)
// ---------------------------------------------------------------------------
function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={d} />
    </svg>
  );
}

const CHECK_CIRCLE = 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.01l-3-3';
const X_CIRCLE = 'M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm3-13-6 6m0-6 6 6';
const FLAG = 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7';
const STAR =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const SIGN_IN = 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3';

// ---------------------------------------------------------------------------
// Hook: get the current user's geolocation (best-effort, no error UI)
// ---------------------------------------------------------------------------
function useGeoProof(): () => Promise<{ lat: number; lng: number } | undefined> {
  return () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(undefined);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 6000, maximumAge: 60_000 },
      );
    });
}

// ---------------------------------------------------------------------------
// Star picker sub-component
// ---------------------------------------------------------------------------
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div role="radiogroup" aria-label="Beoordeling in sterren" style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ster${n > 1 ? 'ren' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 3px',
              cursor: 'pointer',
              color: active ? 'var(--terra)' : 'var(--ink-3)',
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verification vote section
// ---------------------------------------------------------------------------
function VoteSection({ spotId }: { spotId: string }) {
  const getProof = useGeoProof();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function cast(value: 'CONFIRM' | 'DENY') {
    setState('loading');
    const proof = await getProof();
    try {
      const res = await fetch(`/api/v1/me/spots/${spotId}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, ...(proof ? { proof } : {}) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? `Status ${res.status}`);
      }
      setState('done');
      setMsg(value === 'CONFIRM' ? 'Bedankt voor je bevestiging.' : 'Bedankt voor je melding.');
    } catch (err) {
      setState('error');
      setMsg(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.');
    }
  }

  return (
    <section>
      <h3
        style={{
          fontSize: 15,
          fontFamily: 'var(--font-body-stack)',
          fontWeight: 700,
          margin: '0 0 10px',
          color: 'var(--ink)',
        }}
      >
        Verifieer deze plek
      </h3>
      {state === 'done' ? (
        <p style={{ fontSize: 14.5, color: 'var(--moss-700)', margin: 0 }}>
          <Ico d={CHECK_CIRCLE} size={14} /> {msg}
        </p>
      ) : state === 'error' ? (
        <p style={{ fontSize: 14.5, color: 'var(--rust)', margin: '0 0 10px' }}>{msg}</p>
      ) : null}
      {state !== 'done' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={state === 'loading'}
            onClick={() => cast('CONFIRM')}
            style={{ flex: 1 }}
          >
            <Ico d={CHECK_CIRCLE} size={14} /> Klopt
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={state === 'loading'}
            onClick={() => cast('DENY')}
            style={{ flex: 1 }}
          >
            <Ico d={X_CIRCLE} size={14} /> Klopt niet
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
        Eén stem per plek. Je locatie wordt gebruikt om de stem te wegen.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Review form section
// ---------------------------------------------------------------------------
function ReviewSection({ spotId }: { spotId: string }) {
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) return;
    setState('loading');
    try {
      const res = await fetch(`/api/v1/me/spots/${spotId}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, body: body.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? `Status ${res.status}`);
      }
      setState('done');
      setMsg('Je beoordeling is opgeslagen. Dank je!');
    } catch (err) {
      setState('error');
      setMsg(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.');
    }
  }

  if (state === 'done') {
    return (
      <section>
        <h3
          style={{
            fontSize: 15,
            fontFamily: 'var(--font-body-stack)',
            fontWeight: 700,
            margin: '0 0 10px',
            color: 'var(--ink)',
          }}
        >
          Beoordeling
        </h3>
        <p style={{ fontSize: 14.5, color: 'var(--moss-700)', margin: 0 }}>
          <Ico d={STAR} size={14} /> {msg}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3
        style={{
          fontSize: 15,
          fontFamily: 'var(--font-body-stack)',
          fontWeight: 700,
          margin: '0 0 10px',
          color: 'var(--ink)',
        }}
      >
        Beoordeling
      </h3>
      {state === 'error' && (
        <p style={{ fontSize: 14.5, color: 'var(--rust)', marginBottom: 10 }}>{msg}</p>
      )}
      <form onSubmit={(e) => void submit(e)} style={{ display: 'grid', gap: 12 }}>
        <StarPicker value={stars} onChange={setStars} />
        <textarea
          aria-label="Optionele reactie"
          placeholder="Vertel wat meer (optioneel)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={3}
          style={{
            width: '100%',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '9px 12px',
            fontFamily: 'var(--font-body-stack)',
            fontSize: 14,
            color: 'var(--ink)',
            background: 'var(--cream)',
            resize: 'vertical',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={stars < 1 || state === 'loading'}
          style={{ justifySelf: 'start' }}
        >
          Opslaan
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Report section
// ---------------------------------------------------------------------------
function ReportSection({ spotId }: { spotId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('WRONG_INFO');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/v1/me/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'SPOT',
          targetId: spotId,
          reason,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? `Status ${res.status}`);
      }
      setState('done');
      setMsg('Je melding is ontvangen. Bedankt.');
    } catch (err) {
      setState('error');
      setMsg(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.');
    }
  }

  if (state === 'done') {
    return (
      <p style={{ fontSize: 13.5, color: 'var(--moss-700)', margin: 0 }}>
        <Ico d={FLAG} size={13} /> {msg}
      </p>
    );
  }

  return (
    <section>
      {!open ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen(true)}
          style={{ fontSize: 13 }}
        >
          <Ico d={FLAG} size={13} /> Melden
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)} style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Melden</p>
          {state === 'error' && (
            <p style={{ fontSize: 13.5, color: 'var(--rust)', margin: 0 }}>{msg}</p>
          )}
          <select
            aria-label="Reden"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontFamily: 'var(--font-body-stack)',
              fontSize: 13.5,
              background: 'var(--cream)',
              color: 'var(--ink)',
            }}
          >
            <option value="WRONG_INFO">Onjuiste informatie</option>
            <option value="DUPLICATE">Dubbele plek</option>
            <option value="INAPPROPRIATE">Ongepaste inhoud</option>
            <option value="SPAM">Spam</option>
            <option value="DOES_NOT_EXIST">Bestaat niet (meer)</option>
            <option value="OTHER">Anders</option>
          </select>
          <textarea
            aria-label="Toelichting (optioneel)"
            placeholder="Toelichting (optioneel)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={2}
            style={{
              width: '100%',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontFamily: 'var(--font-body-stack)',
              fontSize: 13.5,
              color: 'var(--ink)',
              background: 'var(--cream)',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-danger btn-sm" disabled={state === 'loading'}>
              Versturen
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Annuleren
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function SpotParticipation({ spotId, status }: SpotParticipationProps) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  // Only meaningful for visible spots; HIDDEN/REMOVED pages 404 anyway, but
  // skip rendering for safety.
  if (status === 'HIDDEN' || status === 'REMOVED') return null;

  if (!session?.user) {
    return (
      <div
        className="card"
        style={{
          padding: 20,
          background: 'var(--moss-soft)',
          border: 'none',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--moss-700)' }}>
          Log in om deze plek te beoordelen of verifiëren.
        </p>
        <a
          className="btn btn-primary btn-sm"
          href={`/signin?next=${encodeURIComponent(pathname ?? '/')}`}
          style={{ display: 'inline-flex' }}
        >
          <Ico d={SIGN_IN} size={14} /> Inloggen
        </a>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, display: 'grid', gap: 22 }}>
      <VoteSection spotId={spotId} />
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: 0 }} />
      <ReviewSection spotId={spotId} />
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: 0 }} />
      <ReportSection spotId={spotId} />
    </div>
  );
}
