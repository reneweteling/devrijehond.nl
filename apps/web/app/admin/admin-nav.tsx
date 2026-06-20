'use client';

import { usePathname } from 'next/navigation';

const STAFF_LINKS: [string, string][] = [
  ['/admin', 'Overzicht'],
  ['/admin/spots', 'Plekken'],
  ['/admin/reports', 'Meldingen'],
  ['/admin/taxonomy', 'Taxonomie'],
  ['/admin/feature-requests', 'Wensen'],
];

const ADMIN_LINKS: [string, string][] = [
  ['/admin/users', 'Gebruikers'],
  ['/admin/applications', 'Aanmeldingen'],
];

export function AdminNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const path = usePathname();
  const links = isAdmin ? [...STAFF_LINKS, ...ADMIN_LINKS] : STAFF_LINKS;
  return (
    <div className="admin-nav">
      {links.map(([href, label]) => (
        <a key={href} href={href} className={path === href ? 'active' : ''}>
          {label}
        </a>
      ))}
      <a href="/" target="_blank" rel="noreferrer">
        Bekijk site ↗
      </a>
    </div>
  );
}
