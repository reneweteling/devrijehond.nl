'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
// Dogs section — helpers
// ---------------------------------------------------------------------------

const DOG_INPUT_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  fontSize: 15,
};

/** Returns age string like "3 jr" or "8 mnd", computed from birthDate (YYYY-MM-DD) or birthYear. */
function dogAge(d: DogDto): string | null {
  const today = new Date();

  if (d.birthDate) {
    const birth = new Date(d.birthDate);
    if (isNaN(birth.getTime())) return null;
    const months =
      (today.getFullYear() - birth.getFullYear()) * 12 +
      (today.getMonth() - birth.getMonth()) -
      (today.getDate() < birth.getDate() ? 1 : 0);
    if (months < 0) return null;
    if (months < 12) return `${months} mnd`;
    return `${Math.floor(months / 12)} jr`;
  }

  if (d.birthYear) {
    const years = today.getFullYear() - d.birthYear;
    if (years < 0) return null;
    return `${years} jr`;
  }

  return null;
}

/** Upload a single File to /api/v1/me/uploads and return its publicUrl. */
async function uploadDogPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/v1/me/uploads', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error('Upload mislukt.');
  const { publicUrl } = (await res.json()) as { publicUrl: string };
  return publicUrl;
}

// ---------------------------------------------------------------------------
// Inline edit form for a single dog
// ---------------------------------------------------------------------------

function DogEditRow({
  dog,
  onSaved,
  onCancel,
}: {
  dog: DogDto;
  onSaved: (updated: DogDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(dog.name);
  const [breed, setBreed] = useState(dog.breed ?? '');
  const [birthDate, setBirthDate] = useState(dog.birthDate ?? '');
  const [photoUrl, setPhotoUrl] = useState(dog.photoUrl ?? '');
  const [photoPreview, setPhotoPreview] = useState(dog.photoUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const preview = URL.createObjectURL(file);
      const url = await uploadDogPhoto(file);
      setPhotoUrl(url);
      setPhotoPreview(preview);
    } catch {
      setErr('Foto uploaden mislukt.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (breed.trim()) body.breed = breed.trim();
      if (birthDate) body.birthDate = birthDate;
      if (photoUrl) body.photoUrl = photoUrl;
      const updated = await apiFetch<DogDto>(`/api/v1/me/dogs/${dog.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="card"
      style={{ padding: '16px 18px', display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Naam *</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Naam"
            style={DOG_INPUT_STYLE}
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
            style={DOG_INPUT_STYLE}
          />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Geboortedatum</span>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          style={DOG_INPUT_STYLE}
        />
      </label>
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Foto</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {photoPreview && (
            <img
              src={photoPreview}
              alt=""
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--line)',
                flexShrink: 0,
              }}
            />
          )}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 999,
              border: '1.5px solid var(--line)',
              background: uploading ? 'var(--moss-soft)' : 'var(--cream)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink-2)',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploaden…' : photoPreview ? 'Andere foto' : 'Foto kiezen'}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              disabled={uploading}
              onChange={handlePhoto}
              style={{ display: 'none' }}
            />
          </label>
          {photoPreview && !uploading && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPhotoUrl('');
                setPhotoPreview('');
              }}
              style={{ fontSize: 13, color: 'var(--rust)', padding: '4px 8px' }}
            >
              Verwijderen
            </button>
          )}
        </div>
      </div>
      {err && <p style={{ margin: 0, color: 'var(--rust)', fontSize: 13.5 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || uploading}>
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Dogs section
// ---------------------------------------------------------------------------

function DogsSection({ dogs: initialDogs }: { dogs: DogDto[] }) {
  const [dogs, setDogs] = useState<DogDto[]>(initialDogs);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [addPhotoUrl, setAddPhotoUrl] = useState('');
  const [addPhotoPreview, setAddPhotoPreview] = useState('');
  const [addUploading, setAddUploading] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setAddUploading(true);
    try {
      const preview = URL.createObjectURL(file);
      const url = await uploadDogPhoto(file);
      setAddPhotoUrl(url);
      setAddPhotoPreview(preview);
    } catch {
      setErr('Foto uploaden mislukt.');
    } finally {
      setAddUploading(false);
      if (addFileRef.current) addFileRef.current.value = '';
    }
  };

  const addDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (breed.trim()) body.breed = breed.trim();
      if (birthDate) body.birthDate = birthDate;
      if (addPhotoUrl) body.photoUrl = addPhotoUrl;
      const created = await apiFetch<DogDto>('/api/v1/me/dogs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setDogs((prev) => [...prev, created]);
      setName('');
      setBreed('');
      setBirthDate('');
      setAddPhotoUrl('');
      setAddPhotoPreview('');
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

  const handleSaved = (updated: DogDto) => {
    setDogs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setEditingId(null);
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
          {dogs.map((d) => {
            if (editingId === d.id) {
              return (
                <DogEditRow
                  key={d.id}
                  dog={d}
                  onSaved={handleSaved}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            const age = dogAge(d);
            const subtitle = [d.breed, age].filter(Boolean).join(' · ');
            return (
              <div key={d.id} className="card dog-row" style={{ padding: '12px 18px' }}>
                <div className="dog-info">
                  {d.photoUrl ? (
                    <img
                      src={d.photoUrl}
                      alt={d.name}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid var(--line)',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'var(--moss-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      🐾
                    </div>
                  )}
                  <div className="dog-meta">
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{d.name}</span>
                    {subtitle && (
                      <span className="muted dog-sub" style={{ fontSize: 13.5, marginLeft: 8 }}>
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="dog-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingId(d.id)}
                    style={{ padding: '4px 10px' }}
                  >
                    Aanpassen
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeDog(d.id)}
                    style={{
                      color: 'var(--rust)',
                      borderColor: 'transparent',
                      padding: '4px 10px',
                    }}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <form
          onSubmit={addDog}
          className="card"
          style={{ padding: '20px 22px', display: 'grid', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Naam *</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Naam van je hond"
                style={DOG_INPUT_STYLE}
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
                style={DOG_INPUT_STYLE}
              />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
              Geboortedatum
            </span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              style={DOG_INPUT_STYLE}
            />
          </label>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
              Foto <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(optioneel)</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {addPhotoPreview && (
                <img
                  src={addPhotoPreview}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--line)',
                    flexShrink: 0,
                  }}
                />
              )}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: '1.5px solid var(--line)',
                  background: addUploading ? 'var(--moss-soft)' : 'var(--cream)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--ink-2)',
                  cursor: addUploading ? 'not-allowed' : 'pointer',
                }}
              >
                {addUploading ? 'Uploaden…' : addPhotoPreview ? 'Andere foto' : 'Foto kiezen'}
                <input
                  ref={addFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  disabled={addUploading}
                  onChange={handleAddPhoto}
                  style={{ display: 'none' }}
                />
              </label>
              {addPhotoPreview && !addUploading && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setAddPhotoUrl('');
                    setAddPhotoPreview('');
                  }}
                  style={{ fontSize: 13, color: 'var(--rust)', padding: '4px 8px' }}
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
          {err && <p style={{ margin: 0, color: 'var(--rust)', fontSize: 13.5 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving || addUploading}
            >
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
