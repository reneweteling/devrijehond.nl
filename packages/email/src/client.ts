/**
 * Resend client for transactional email.
 *
 * The API key + default sender are read from the environment so the same module
 * works across local / accept / production without code changes. We construct
 * the client lazily so that importing this package in a build step (e.g. type
 * checking, OpenAPI generation) doesn't require RESEND_API_KEY to be set.
 */

import { Resend } from 'resend';

let cached: Resend | undefined;

/** Lazily-constructed singleton Resend client. */
export function getResend(): Resend {
  if (!cached) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('[email] RESEND_API_KEY is not set');
    }
    cached = new Resend(apiKey);
  }
  return cached;
}

/** The default "from" address (e.g. `De Vrije Hond <hallo@devrijehond.nl>`). */
export function defaultFrom(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error('[email] EMAIL_FROM is not set');
  }
  return from;
}
