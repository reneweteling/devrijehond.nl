// Enable the PostGIS extension before migrations run (the initial migration
// creates geometry columns, which require the extension to already exist).
// Idempotent: CREATE EXTENSION IF NOT EXISTS.
/* global process, console */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[ensure-postgis] DATABASE_URL is not set');
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL === 'true';
const pool = new pg.Pool({
  connectionString: url,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

try {
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  console.log('[ensure-postgis] PostGIS extension ready');
} catch (err) {
  console.error('[ensure-postgis] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await pool.end();
}
