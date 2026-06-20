import type { ReactNode } from 'react';

import { PawMark } from '../(site)/site-chrome';
import { AdminNav } from './admin-nav';
import { currentStaff } from '@/lib/admin-db';

/**
 * Admin shell: a dark header with the brand + a role tag and the section nav.
 * The route is staff-gated upstream by proxy.ts (ADMIN or MODERATOR); pages
 * re-assert via staffDb() / adminDb(). The "Gebruikers" tab is ADMIN-only.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await currentStaff();
  const isAdmin = staff.role === 'ADMIN';
  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="admin-header">
        <nav className="container">
          <span className="admin-brand">
            <PawMark size={22} color="#cdd3b0" />
            De Vrije Hond <span className="tag">{isAdmin ? 'Admin' : 'Moderator'}</span>
          </span>
          <AdminNav isAdmin={isAdmin} />
        </nav>
      </header>
      <main className="container" style={{ paddingTop: 28, paddingBottom: 72 }}>
        {children}
      </main>
    </div>
  );
}
