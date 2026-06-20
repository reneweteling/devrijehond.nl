'use client';

import { useState } from 'react';
import { authClient } from '@devrijehond/auth/client';

/**
 * Magic-link sign-in form for the admin area. Sends a login link to the email;
 * the link returns to `next` (default /admin). In local dev (no RESEND_API_KEY)
 * the link is also printed to the web server console.
 */
export function SignInForm({ next }: { next: string }) {
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
          opent het admin-dashboard.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 18, display: 'grid', gap: 12 }}>
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
      {message ? <p style={{ margin: 0, color: 'var(--rust)', fontSize: 14 }}>{message}</p> : null}
    </form>
  );
}
