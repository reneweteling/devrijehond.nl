'use client';

import { useState, useEffect, useCallback } from 'react';
import { authClient } from '@devrijehond/auth/client';
import type { MeProfileDto, DogDto, SpotSummaryDto } from '@devrijehond/types';

// ---------------------------------------------------------------------------
// Fetch helpers (web auth pattern: credentials: 'include')
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Profile section
// ---------------------------------------------------------------------------

function ProfileSection({ profile, onSaved }: { profile: MeProfileDto; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name ?? '');
  const [handle, setHandle] = useState(profile.handle ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await apiFetch('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || null,
          handle: handle.trim() || null,
          bio: bio.trim() || null,
        }),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 22 }}>Profiel</h2>
        {!editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Bewerken
          </button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={save}
          className="card"
          style={{ padding: '20px 22px', display: 'grid', gap: 14 }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Naam</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Je naam"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 15,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Handle</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              maxLength={30}
              placeholder="gebruikersnaam"
              pattern="[a-z0-9_]+"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 15,
              }}
            />
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              Alleen kleine letters, cijfers en underscores.
            </span>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Vertel iets over jezelf…"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 15,
                resize: 'vertical',
              }}
            />
          </label>
          {err && <p style={{ margin: 0, color: 'var(--rust)', fontSize: 13.5 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditing(false)}
            >
              Annuleren
            </button>
          </div>
        </form>
      ) : (
        <div className="card" style={{ padding: '20px 22px', display: 'grid', gap: 10 }}>
          <Row label="Naam" value={profile.name ?? <span className="muted">Niet ingesteld</span>} />
          <Row
            label="Handle"
            value={
              profile.handle ? `@${profile.handle}` : <span className="muted">Niet ingesteld</span>
            }
          />
          <Row label="Bio" value={profile.bio ?? <span className="muted">Niet ingesteld</span>} />
          <Row label="Reputatie" value={String(profile.reputation)} />
          <Row label="Rol" value={profile.role} />
          <Row label="E-mail" value={profile.email} />
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: 8,
        alignItems: 'start',
        fontSize: 15,
      }}
    >
      <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dogs section
// ---------------------------------------------------------------------------

function DogsSection({ dogs: initialDogs }: { dogs: DogDto[] }) {
  const [dogs, setDogs] = useState<DogDto[]>(initialDogs);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const created = await apiFetch<DogDto>('/api/v1/me/dogs', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), breed: breed.trim() || undefined }),
      });
      setDogs((prev) => [...prev, created]);
      setName('');
      setBreed('');
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Toevoegen mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const removeDog = async (id: string) => {
    try {
      await apiFetch(`/api/v1/me/dogs/${id}`, { method: 'DELETE' });
      setDogs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // show nothing, optimistic is fine here
    }
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 22 }}>Mijn honden</h2>
        {!adding && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            Toevoegen
          </button>
        )}
      </div>

      {dogs.length === 0 && !adding && (
        <p className="muted" style={{ fontSize: 15 }}>
          Je hebt nog geen honden toegevoegd.
        </p>
      )}

      {dogs.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: adding ? 16 : 0 }}>
          {dogs.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{d.name}</span>
                {d.breed && (
                  <span className="muted" style={{ fontSize: 13.5, marginLeft: 8 }}>
                    {d.breed}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeDog(d.id)}
                style={{ color: 'var(--rust)', borderColor: 'transparent', padding: '4px 10px' }}
              >
                Verwijderen
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form
          onSubmit={addDog}
          className="card"
          style={{ padding: '20px 22px', display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Naam *</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Naam van je hond"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 15,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Ras</span>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              maxLength={80}
              placeholder="Bijv. Labrador"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                fontSize: 15,
              }}
            />
          </label>
          {err && <p style={{ margin: 0, color: 'var(--rust)', fontSize: 13.5 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Opslaan…' : 'Toevoegen'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Annuleren
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// My spots section
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Niet geverifieerd',
  VERIFIED: 'Geverifieerd',
  HIDDEN: 'Verborgen',
  REMOVED: 'Verwijderd',
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  VERIFIED: { background: 'var(--moss-soft)', color: 'var(--moss-700)' },
  UNVERIFIED: { background: 'var(--terra-soft)', color: 'var(--terra-700)' },
  HIDDEN: { background: '#f3d0d0', color: '#7a2020' },
  REMOVED: { background: '#e8e8e8', color: '#555' },
};

function SpotsSection({ spots }: { spots: SpotSummaryDto[] }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Mijn inzendingen</h2>

      {spots.length === 0 && (
        <p className="muted" style={{ fontSize: 15 }}>
          Je hebt nog geen plekken ingediend.
        </p>
      )}

      {spots.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {spots.map((s) => {
            const href = `/${s.type === 'REGION' ? 'gebied' : 'plek'}/${s.slug}`;
            const isDistinct = s.status === 'HIDDEN' || s.status === 'REMOVED';
            return (
              <div
                key={s.id}
                className="card"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  opacity: isDistinct ? 0.75 : 1,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <a href={href} style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
                    {s.name}
                  </a>
                  {s.rating.count > 0 && (
                    <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                      ★ {s.rating.average.toFixed(1).replace('.', ',')} · {s.rating.count}
                    </span>
                  )}
                </div>
                <span
                  className="badge"
                  style={STATUS_STYLE[s.status] ?? STATUS_STYLE['UNVERIFIED']}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export function AccountView() {
  const { data: session, isPending } = authClient.useSession();

  const [profile, setProfile] = useState<MeProfileDto | null>(null);
  const [spots, setSpots] = useState<SpotSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr('');
    try {
      const [p, s] = await Promise.all([
        apiFetch<MeProfileDto>('/api/v1/me'),
        apiFetch<{ items: SpotSummaryDto[] }>('/api/v1/me/spots'),
      ]);
      setProfile(p);
      setSpots(s.items);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : 'Laden mislukt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      load();
    } else if (!isPending) {
      setLoading(false);
    }
  }, [session, isPending, load]);

  // Still resolving the session
  if (isPending) {
    return (
      <p className="muted" style={{ marginTop: 40 }}>
        Laden…
      </p>
    );
  }

  // Not signed in
  if (!session?.user) {
    return (
      <div style={{ textAlign: 'center', marginTop: 60 }}>
        <p className="muted" style={{ marginBottom: 20, fontSize: 16 }}>
          Je bent niet ingelogd.
        </p>
        <a href="/signin?next=/account" className="btn btn-primary">
          Inloggen
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="muted" style={{ marginTop: 40 }}>
        Profiel laden…
      </p>
    );
  }

  if (fetchErr || !profile) {
    return (
      <p style={{ marginTop: 40, color: 'var(--rust)' }}>
        {fetchErr || 'Profiel kon niet worden geladen.'}
      </p>
    );
  }

  return (
    <>
      <ProfileSection profile={profile} onSaved={load} />
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0 0 36px' }} />
      <DogsSection dogs={profile.dogs} />
      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0 0 36px' }} />
      <SpotsSection spots={spots} />
    </>
  );
}
