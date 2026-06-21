'use client';

/**
 * Client island for /plek-toevoegen. Manages the full POI-first add-spot flow:
 * pick a point on a Google map (draggable pin), fill in the form, submit.
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { authClient } from '@devrijehond/auth/client';
import type { CategoryDto, AmenityDto } from '@devrijehond/types';
import { RichTextEditor } from '@/app/admin/_components/rich-text-editor';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
// Amsterdam-ish default (same as map-shared.ts).
const DEFAULT_CENTER = { lat: 52.37, lng: 4.89 };
const DEFAULT_ZOOM = 9;

/* -------------------------------------------------------------------------- */
/* Tiny inline icon (Lucide-style paths, same convention as spot-view.tsx)     */
/* -------------------------------------------------------------------------- */
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
const PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z';

/* -------------------------------------------------------------------------- */
/* Shared input / label styling                                                 */
/* -------------------------------------------------------------------------- */
const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
};
const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--ink)',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  fontSize: 15,
  background: 'var(--cream)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
};
const hintStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ink-3)',
};

/* -------------------------------------------------------------------------- */
/* Map picker sub-component                                                     */
/* -------------------------------------------------------------------------- */
function PinMap({
  point,
  onChange,
}: {
  point: { lat: number; lng: number } | null;
  onChange: (p: { lat: number; lng: number }) => void;
}) {
  // After the user pans / clicks once, they keep control of the center.
  const userControlled = useRef(false);

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => {
        if (!e.detail.latLng) return;
        userControlled.current = true;
        onChange({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
      }}
      onDrag={() => {
        userControlled.current = true;
      }}
    >
      {point ? (
        <Marker
          position={point}
          draggable
          onDragEnd={(e) => {
            if (!e.latLng) return;
            onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
          title="Sleep om te verplaatsen"
        />
      ) : null}
    </Map>
  );
}

/* -------------------------------------------------------------------------- */
/* Success state                                                                */
/* -------------------------------------------------------------------------- */
function SuccessCard({ spotSlug, spotName }: { spotSlug: string; spotName: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 28,
        textAlign: 'center',
        borderTop: '3px solid var(--moss)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--moss-soft)',
          color: 'var(--moss-700)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ico d="M20 6 9 17l-5-5" size={22} />
      </div>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>Plek toegevoegd!</h2>
      <p style={{ color: 'var(--ink-2)', marginBottom: 20 }}>
        <strong>{spotName}</strong> staat nu op de kaart als nog niet geverifieerd. De community
        helpt hem bevestigen.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={`/plek/${spotSlug}`} className="btn btn-primary">
          Bekijk de plek
        </a>
        <a href="/plek-toevoegen" className="btn btn-ghost">
          Nog een plek toevoegen
        </a>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main form                                                                    */
/* -------------------------------------------------------------------------- */
export function AddSpotForm() {
  const { data: session, isPending } = authClient.useSession();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [amenities, setAmenities] = useState<AmenityDto[]>([]);

  // Form state.
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [amenityIds, setAmenityIds] = useState<string[]>([]);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ slug: string; name: string } | null>(null);

  // Load POI categories once.
  useEffect(() => {
    fetch('/api/v1/categories?type=POI')
      .then((r) => r.json() as Promise<{ items: CategoryDto[] }>)
      .then((d) => {
        setCategories(d.items ?? []);
        if (d.items?.length) setCategoryId(d.items[0]!.id);
      })
      .catch(() => {});
  }, []);

  // Load amenities filtered by the selected category.
  useEffect(() => {
    if (!categoryId) {
      setAmenities([]);
      return;
    }
    fetch(`/api/v1/amenities?categoryId=${categoryId}`)
      .then((r) => r.json() as Promise<{ items: AmenityDto[] }>)
      .then((d) => {
        setAmenities(d.items ?? []);
        setAmenityIds([]);
      })
      .catch(() => {});
  }, [categoryId]);

  function toggleAmenity(id: string) {
    setAmenityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!point) {
      setError('Zet eerst een punt op de kaart door erop te klikken.');
      return;
    }
    if (!categoryId) {
      setError('Kies een categorie.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        type: 'POI',
        categoryId,
        name: name.trim(),
        point,
        amenityIds,
        photos: [],
      };
      if (description.trim()) body.description = description.trim();
      if (address.trim()) body.address = address.trim();
      if (phone.trim()) body.phone = phone.trim();
      if (website.trim()) body.website = website.trim();

      const res = await fetch('/api/v1/me/spots', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? 'Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }

      const created = (await res.json()) as { slug?: string; name?: string };
      setSuccess({ slug: created.slug ?? '', name: created.name ?? name.trim() });
    } catch {
      setError('Verbindingsfout. Controleer je internetverbinding en probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  }

  // Auth loading state.
  if (isPending) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)' }}>Laden…</div>
    );
  }

  // Not signed in: show CTA.
  if (!session) {
    return (
      <div
        className="card"
        style={{ padding: 32, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--moss-soft)',
            color: 'var(--moss-700)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ico d={PIN} size={22} />
        </div>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>Inloggen vereist</h2>
        <p style={{ color: 'var(--ink-2)', marginBottom: 22 }}>
          Je hebt een account nodig om een plek toe te voegen. Log in met je e-mailadres.
        </p>
        <a
          href={`/signin?next=${encodeURIComponent('/plek-toevoegen')}`}
          className="btn btn-primary"
        >
          Inloggen
        </a>
      </div>
    );
  }

  // Success state.
  if (success) {
    return <SuccessCard spotSlug={success.slug} spotName={success.name} />;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 32 }}>
      {/* Map picker */}
      <div>
        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Locatie</span>
          <p style={{ ...hintStyle, marginTop: 4 }}>
            Klik op de kaart om een punt te zetten. Sleep de speld om hem te verplaatsen.
          </p>
        </div>
        <div
          style={{
            height: 380,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-sm)',
            background: 'var(--moss-soft)',
          }}
        >
          {GOOGLE_MAPS_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_KEY}>
              <PinMap point={point} onChange={setPoint} />
            </APIProvider>
          ) : (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                height: '100%',
                color: 'var(--ink-3)',
                fontSize: 14,
              }}
            >
              Kaart is tijdelijk niet beschikbaar.
            </div>
          )}
        </div>
        {point ? (
          <p style={{ ...hintStyle, marginTop: 8 }}>
            <Ico d={PIN} size={13} />
            <span style={{ marginLeft: 5 }}>
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
            </span>
          </p>
        ) : (
          <p style={{ ...hintStyle, marginTop: 8, color: 'var(--terra-700)' }}>
            Nog geen punt gezet.
          </p>
        )}
      </div>

      {/* Spot details */}
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Category */}
        <div style={fieldStyle}>
          <label htmlFor="categoryId" style={labelStyle}>
            Categorie
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {categories.length === 0 ? (
              <option disabled>Laden…</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Name */}
        <div style={fieldStyle}>
          <label htmlFor="name" style={labelStyle}>
            Naam van de plek
          </label>
          <input
            id="name"
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="bijv. Café Waf, Waterspeelplaats Beatrixpark"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div style={fieldStyle}>
          <label style={labelStyle}>
            Beschrijving <span style={hintStyle}>(optioneel)</span>
          </label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Wat maakt deze plek bijzonder voor honden?"
          />
        </div>
      </div>

      {/* Amenities */}
      {amenities.length > 0 ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>Voorzieningen</span>
            <p style={{ ...hintStyle, marginTop: 4 }}>Meerdere keuzes mogelijk.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            {amenities.map((a) => {
              const selected = amenityIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    border: `1.5px solid ${selected ? 'var(--moss)' : 'var(--line)'}`,
                    background: selected ? 'var(--moss-soft)' : '#fff',
                    color: selected ? 'var(--moss-700)' : 'var(--ink-2)',
                    fontWeight: selected ? 600 : 500,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Optional contact details */}
      <details style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--ink)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            userSelect: 'none',
          }}
        >
          Contactgegevens <span style={hintStyle}>(optioneel)</span>
        </summary>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div style={fieldStyle}>
            <label htmlFor="address" style={labelStyle}>
              Adres
            </label>
            <input
              id="address"
              type="text"
              maxLength={240}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straat 1, 1234 AB Stad"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="phone" style={labelStyle}>
              Telefoon
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+31 20 123 4567"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor="website" style={labelStyle}>
              Website
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://voorbeeld.nl"
              style={inputStyle}
            />
          </div>
        </div>
      </details>

      {/* REGION note */}
      <div
        style={{
          background: 'var(--moss-soft)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          fontSize: 14,
          color: 'var(--moss-700)',
        }}
      >
        Wil je een <strong>losloopgebied of hondenstrand</strong> (vlakke regio) toevoegen? Gebruik
        de app: die heeft een kaarteditor om het gebied in te tekenen.
      </div>

      {/* Error */}
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(163,59,45,0.08)',
            color: 'var(--rust)',
            fontSize: 14,
          }}
        >
          {error}
        </p>
      ) : null}

      {/* Submit */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ minWidth: 180 }}
        >
          {submitting ? 'Opslaan…' : 'Plek toevoegen'}
        </button>
        <a href="/" className="btn btn-ghost">
          Annuleren
        </a>
      </div>
    </form>
  );
}
