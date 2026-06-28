import { z } from 'zod';
import '../registry';

/**
 * Account deletion, `DELETE /api/v1/me/account`. Auth required.
 *
 * Hard-deletes the authenticated user and their personal data. Community spots
 * they submitted stay on the map (reassigned to a system account server-side).
 * Returns `{ ok: true }` on success; a missing account is also treated as
 * success so the client can clear local state.
 */
export const AccountDeletionResponseSchema = z
  .object({
    ok: z.literal(true).openapi({ description: 'The account was deleted (or already gone).' }),
  })
  .openapi('AccountDeletionResponse', {
    description: 'Acknowledgement that the account was deleted.',
  });
export type AccountDeletionResponseDto = z.infer<typeof AccountDeletionResponseSchema>;
