import Image from 'next/image';

/**
 * Branded Dutch 404. Lives at the app root so it catches unmatched routes
 * sitewide; self-contained styling (it renders outside the (site) chrome).
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        gap: 18,
      }}
    >
      <Image src="/logo.png" alt="" width={64} height={50} style={{ display: 'block' }} />
      <h1 style={{ fontSize: 30, margin: 0 }}>Pagina niet gevonden</h1>
      <p style={{ color: 'var(--ink-2)', margin: 0, maxWidth: '44ch' }}>
        Deze plek bestaat niet (meer). Misschien is de link verouderd of verkeerd overgenomen.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <a className="btn btn-primary" href="/kaart">
          Naar de kaart
        </a>
        <a className="btn" href="/">
          Naar de homepagina
        </a>
      </div>
    </main>
  );
}
