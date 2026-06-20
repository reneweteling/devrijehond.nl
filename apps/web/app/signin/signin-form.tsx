'use client';

import { useState } from 'react';
import { authClient } from '@devrijehond/auth/client';

/**
 * Magic-link sign-in form. Sends a login link to the email; the link returns to
 * `next` (default /account). In local dev (no RESEND_API_KEY) the link is also
 * printed to the web server console.
 */
export function SignInForm({ next = '/account' }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setMessage('');
    const { error } = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: next,
    });
    if (error) {
      setState('error');
      setMessage('Versturen mislukt. Probeer het opnieuw.');
    } else {
      setState('sent');
    }
  };

  if (state === 'sent') {
    return (
      <div className="card" style={{ padding: 22, marginTop: 18 }}>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          Check je mail, we hebben een inloglink gestuurd naar <strong>{email}</strong>. De link
          brengt je direct terug naar de pagina.
        </p>
      </div>
    );
  }

  const google = async () => {
    setMessage('');
    await authClient.signIn.social({ provider: 'google', callbackURL: next });
  };

  return (
    <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
      <button type="button" className="btn btn-ghost" onClick={google} style={{ width: '100%' }}>
        <GoogleG /> Inloggen met Google
      </button>

      <div className="signin-or">
        <span>of met e-mail</span>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jij@voorbeeld.nl"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={state === 'sending'}
          style={{ width: '100%' }}
        >
          {state === 'sending' ? 'Versturen…' : 'Stuur inloglink'}
        </button>
        {message ? (
          <p style={{ margin: 0, color: 'var(--rust)', fontSize: 14 }}>{message}</p>
        ) : null}
      </form>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9h-7.3v5.7C8.8 41.1 15.8 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.8 2 8.8 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"
      />
    </svg>
  );
}
