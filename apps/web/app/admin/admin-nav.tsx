'use client';

import { usePathname } from 'next/navigation';

const LINKS: [string, string][] = [
  ['/admin', 'Overzicht'],
  ['/admin/taxonomy', 'Taxonomie'],
  ['/admin/feature-requests', 'Wensen'],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <div className="admin-nav">
      {LINKS.map(([href, label]) => (
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
