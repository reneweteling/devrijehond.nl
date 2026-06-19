/**
 * @devrijehond/email — transactional email via Resend + React Email.
 *
 * Exports:
 *   - `sendEmail`     — generic send (subject + React node, or raw html/text).
 *   - `sendMagicLink` — renders the magic-link template and sends it.
 */

import { render } from '@react-email/render';
import { getResend, defaultFrom } from './client';
import { MagicLinkEmail } from '../templates/magic-link';

export { getResend, defaultFrom } from './client';
export { MagicLinkEmail } from '../templates/magic-link';
export type { MagicLinkEmailProps } from '../templates/magic-link';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** A React Email node; rendered to HTML + a plain-text fallback. */
  react?: React.ReactElement;
  /** Pre-rendered HTML (used when `react` is not provided). */
  html?: string;
  /** Plain-text body (optional fallback). */
  text?: string;
  /** Override the default sender. */
  from?: string;
}

/**
 * Generic transactional send. Prefer passing a React Email node via `react`;
 * `sendMagicLink` is built on top of this.
 */
export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, react, html, text, from } = options;

  const resolvedHtml = react ? await render(react) : html;
  const resolvedText =
    text ?? (react ? await render(react, { plainText: true }) : undefined);

  if (!resolvedHtml && !resolvedText) {
    throw new Error('[email] sendEmail requires `react`, `html`, or `text`');
  }

  const { data, error } = await getResend().emails.send({
    from: from ?? defaultFrom(),
    to,
    subject,
    ...(resolvedHtml ? { html: resolvedHtml } : {}),
    ...(resolvedText ? { text: resolvedText } : {}),
  });

  if (error) {
    throw new Error(`[email] failed to send "${subject}": ${error.message}`);
  }
  return data;
}

export interface SendMagicLinkOptions {
  email: string;
  /** The (already HTTPS-rewritten) sign-in URL. */
  url: string;
}

/**
 * Render and send the magic-link email. The `url` must already be the final
 * HTTPS link — `@devrijehond/auth` performs the mobile deep-link rewrite to an
 * HTTPS interstitial before calling this.
 */
export async function sendMagicLink({ email, url }: SendMagicLinkOptions) {
  return sendEmail({
    to: email,
    subject: 'Je inloglink voor De Vrije Hond',
    react: MagicLinkEmail({ url }),
  });
}
