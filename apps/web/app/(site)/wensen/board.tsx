'use client';

import { useState, useOptimistic, useTransition } from 'react';
import { authClient } from '@devrijehond/auth/client';
import type { FeatureRequestDto, FeatureRequestsResponseDto } from '@devrijehond/types';

// ---- Status helpers --------------------------------------------------------

type FeatureStatus = FeatureRequestDto['status'];

const STATUS_LABELS: Record<FeatureStatus, string> = {
  CONSIDERING: 'In overweging',
  PLANNED: 'Gepland',
  DONE: 'Klaar',
  DECLINED: 'Afgewezen',
};

const STATUS_COLORS: Record<FeatureStatus, { bg: string; text: string }> = {
  CONSIDERING: { bg: 'var(--terra-soft)', text: 'var(--terra-700)' },
  PLANNED: { bg: 'var(--moss-soft)', text: 'var(--moss-700)' },
  DONE: { bg: '#dff0e2', text: '#2e6b38' },
  DECLINED: { bg: '#f2e0de', text: 'var(--rust)' },
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  const { bg, text } = STATUS_COLORS[status];
  return (
    <span
      className="badge"
      style={{ background: bg, color: text }}
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---- Filter tabs -----------------------------------------------------------

const TABS: Array<{ label: string; value: FeatureStatus | 'all' }> = [
  { label: 'Populair', value: 'all' },
  { label: 'In overweging', value: 'CONSIDERING' },
  { label: 'Gepland', value: 'PLANNED' },
  { label: 'Klaar', value: 'DONE' },
  { label: 'Afgewezen', value: 'DECLINED' },
];

// ---- Upvote button ---------------------------------------------------------

function UpvoteButton({
  id,
  count,
  voted,
  onToggle,
}: {
  id: string;
  count: number;
  voted: boolean;
  onToggle: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await onToggle(id);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-pressed={voted}
      aria-label={voted ? 'Stem verwijderen' : 'Stem geven'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 14px',
        borderRadius: 12,
        border: `1.5px solid ${voted ? 'var(--moss)' : 'var(--line)'}`,
        background: voted ? 'var(--moss-soft)' : 'var(--cream)',
        color: voted ? 'var(--moss-700)' : 'var(--ink-2)',
        cursor: pending ? 'wait' : 'pointer',
        fontFamily: 'var(--font-display-stack)',
        fontWeight: 600,
        fontSize: 18,
        lineHeight: 1,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        flex: 'none',
        opacity: pending ? 0.6 : 1,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>
        {voted ? '▲' : '△'}
      </span>
      <span style={{ fontSize: 13 }}>{count}</span>
    </button>
  );
}

// ---- Single item -----------------------------------------------------------

function RequestCard({
  item,
  onToggle,
}: {
  item: FeatureRequestDto;
  onToggle: ((id: string) => Promise<void>) | null;
}) {
  const [optimistic, applyOptimistic] = useOptimistic(
    { count: item.upvoteCount, voted: item.viewerHasVoted },
    (_state, next: { count: number; voted: boolean }) => next,
  );

  async function handleToggle(id: string) {
    // Optimistic update immediately
    applyOptimistic({
      count: optimistic.voted ? optimistic.count - 1 : optimistic.count + 1,
      voted: !optimistic.voted,
    });
    if (onToggle) await onToggle(id);
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 20px',
      }}
    >
      {onToggle ? (
        <UpvoteButton
          id={item.id}
          count={optimistic.count}
          voted={optimistic.voted}
          onToggle={handleToggle}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '8px 14px',
            borderRadius: 12,
            border: '1.5px solid var(--line)',
            background: 'var(--cream)',
            color: 'var(--ink-2)',
            fontFamily: 'var(--font-display-stack)',
            fontWeight: 600,
            fontSize: 18,
            lineHeight: 1,
            flex: 'none',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 15 }}>
            △
          </span>
          <span style={{ fontSize: 13 }}>{optimistic.count}</span>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{item.title}</span>
        </div>

        {item.body ? (
          <p style={{ margin: '0 0 8px', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {item.body}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={item.status} />
          {item.component ? (
            <span className="chip" style={{ padding: '3px 10px', fontSize: 13 }}>
              {item.component}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---- New-request form ------------------------------------------------------

function NewRequestForm({ onCreated }: { onCreated: (item: FeatureRequestDto) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [component, setComponent] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const COMPONENTS = ['Kaart', 'Inzenden', 'Profiel', 'Anders'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setState('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/me/feature-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
          component: component || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { data: FeatureRequestDto };
      onCreated(data.data);
      setTitle('');
      setBody('');
      setComponent('');
      setState('idle');
      setOpen(false);
    } catch {
      setState('error');
      setErrorMsg('Versturen mislukt. Probeer het opnieuw.');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 13px',
    borderRadius: 10,
    border: '1px solid var(--line)',
    fontSize: 15,
    fontFamily: 'var(--font-body-stack)',
    background: 'var(--cream)',
    color: 'var(--ink)',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        style={{ marginBottom: 28 }}
      >
        + Nieuw verzoek
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: '22px 24px', marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Nieuw verzoek indienen</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div>
          <label
            htmlFor="fr-title"
            style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}
          >
            Titel{' '}
            <span aria-hidden="true" style={{ color: 'var(--rust)' }}>
              *
            </span>
          </label>
          <input
            id="fr-title"
            type="text"
            required
            minLength={4}
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv: Filters op loopafstand"
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="fr-body"
            style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}
          >
            Toelichting (optioneel)
          </label>
          <textarea
            id="fr-body"
            maxLength={4000}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Meer context over je verzoek..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label
            htmlFor="fr-component"
            style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}
          >
            Onderdeel (optioneel)
          </label>
          <select
            id="fr-component"
            value={component}
            onChange={(e) => setComponent(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecteer...</option>
            {COMPONENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {errorMsg ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--rust)' }}>{errorMsg}</p>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={state === 'sending' || !title.trim()}
          >
            {state === 'sending' ? 'Versturen…' : 'Indienen'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setOpen(false);
              setState('idle');
              setErrorMsg('');
            }}
          >
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- Sign-in CTA -----------------------------------------------------------

function SignInCta() {
  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}
    >
      <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 15 }}>
        Log in om te stemmen of een verzoek in te dienen.
      </p>
      <a href="/signin?next=/wensen" className="btn btn-primary btn-sm">
        Inloggen
      </a>
    </div>
  );
}

// ---- Board (top-level client island) ---------------------------------------

export function FeatureBoard({ initial }: { initial: FeatureRequestsResponseDto }) {
  const { data: session } = authClient.useSession();
  const signedIn = !!session?.user;

  const [activeTab, setActiveTab] = useState<FeatureStatus | 'all'>('all');
  const [items, setItems] = useState<FeatureRequestDto[]>(initial.items);
  const [loading, setLoading] = useState(false);

  // Refetch when tab changes (server already fetched all for initial render).
  async function handleTabChange(tab: FeatureStatus | 'all') {
    setActiveTab(tab);
    setLoading(true);
    try {
      const url =
        tab === 'all' ? '/api/v1/feature-requests' : `/api/v1/feature-requests?status=${tab}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { data: FeatureRequestsResponseDto };
        setItems(data.data.items);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVote(id: string) {
    const res = await fetch(`/api/v1/me/feature-requests/${id}/vote`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      data: { requestId: string; upvoteCount: number; viewerHasVoted: boolean };
    };
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              upvoteCount: data.data.upvoteCount,
              viewerHasVoted: data.data.viewerHasVoted,
            }
          : item,
      ),
    );
  }

  function handleCreated(item: FeatureRequestDto) {
    // Prepend to the list and switch to "all" view so the user sees it.
    setItems((prev) => [item, ...prev]);
    setActiveTab('all');
  }

  const filtered = activeTab === 'all' ? items : items.filter((i) => i.status === activeTab);

  return (
    <div>
      {signedIn ? <NewRequestForm onCreated={handleCreated} /> : <SignInCta />}

      {/* Filter tabs */}
      <div
        role="tablist"
        aria-label="Filter op status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              onClick={() => handleTabChange(tab.value)}
              className={active ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ minWidth: 'fit-content' }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="muted" style={{ textAlign: 'center', padding: 40 }}>
          Laden…
        </p>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--ink-2)' }}
        >
          Geen verzoeken gevonden voor dit filter.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((item) => (
            <RequestCard key={item.id} item={item} onToggle={signedIn ? handleToggleVote : null} />
          ))}
        </div>
      )}
    </div>
  );
}
