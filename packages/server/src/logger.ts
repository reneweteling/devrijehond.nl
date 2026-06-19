import { pino, type Logger } from 'pino';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pinoPretty from 'pino-pretty';

/**
 * Shared pino logger for the De Vrije Hond server surface — the API route
 * handlers, server actions and (eventually) workers.
 *
 * Mirrors dekmantel/packages/server/logger.ts:
 *   - Production (`NODE_ENV=production`): structured JSON lines on stdout.
 *   - Dev: pretty-printed via `pino-pretty` as a SYNC destination (a
 *     `transport` config spawns a worker thread via thread-stream which
 *     Next's bundler can't locate post-build).
 *
 * Call sites should attach request-scoped context via `logger.child({...})`
 * rather than mutating this logger.
 */

const isProd = process.env.NODE_ENV === 'production';

const baseOpts = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: {
    service: 'devrijehond-server',
    env: process.env.NODE_ENV ?? 'development',
  },
};

export const logger: Logger = isProd
  ? pino(baseOpts)
  : pino(
      baseOpts,
      pinoPretty({
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        sync: true,
      }),
    );

export type { Logger };
