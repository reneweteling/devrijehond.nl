'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@devrijehond/auth/client';

/**
 * Client island rendered inside the site header. Shows an "Inloggen" link when
 * the user has no session, or the user's name linking to /account when signed in.
 * Admins and moderators also get a "Beheer" link. A small sign-out button closes
 * the session and reloads the page.
 */
export function HeaderAccount() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  if (!session?.user) {
    return (
      <a href="/signin" style={{ color: 'var(--ink-2)', fontSize: 15, fontWeight: 500 }}>
        Inloggen
      </a>
    );
  }

  const user = session.user as typeof session.user & { role?: string };
  const isStaff = user.role === 'ADMIN' || user.role === 'MODERATOR';

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
      {isStaff && (
        <a href="/admin" style={{ color: 'var(--ink-2)', fontSize: 15, fontWeight: 500 }}>
          Beheer
        </a>
      )}
      <a href="/account" style={{ color: 'var(--moss-700)', fontSize: 15, fontWeight: 600 }}>
        {user.name ?? user.email}
      </a>
      <button
        type="button"
        onClick={handleSignOut}
        className="btn btn-ghost btn-sm"
        style={{ padding: '6px 12px' }}
      >
        Uitloggen
      </button>
    </span>
  );
}
