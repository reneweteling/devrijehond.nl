import type { ReactNode } from 'react';

import { PawMark } from '../(site)/site-chrome';
import { AdminNav } from './admin-nav';

/**
 * Admin shell: a dark header with the brand + a "Beheer" tag and the section
 * nav. The route is ADMIN-gated upstream by proxy.ts; pages re-assert via
 * adminDb().
 */
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="admin-header">
        <nav className="container">
          <span className="admin-brand">
            <PawMark size={22} color="#cdd3b0" />
            De Vrije Hond <span className="tag">Beheer</span>
          </span>
          <AdminNav />
        </nav>
      </header>
      <main className="container" style={{ paddingTop: 28, paddingBottom: 72 }}>
        {children}
      </main>
    </div>
  );
}
