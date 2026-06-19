/**
 * Community-verification thresholds + recompute logic.
 *
 * Spec (docs/wireframes-mobile.md §"verification model"):
 *   - Auto-verify when the weighted net score (confirms − denies) reaches +5.
 *   - Auto-hide when a spot accrues 3 denials.
 *   - CONFLICT RULE: auto-hide TAKES PRECEDENCE — a spot that reaches both +5
 *     net and 3 denials at once goes HIDDEN (safety first).
 *
 * Thresholds are exported as named constants so the admin (and a future
 * admin-configurable settings row) reference a single source of truth.
 */

import type { SpotStatus, VoteValue } from '@devrijehond/db';

/** Net weighted score (confirmScore − denyScore) at/above which a spot verifies. */
export const VERIFY_NET_SCORE = 5;

/** Number of DENY votes at/above which a spot auto-hides. */
export const HIDE_DENY_COUNT = 3;

export interface VoteTally {
  confirmScore: number;
  denyScore: number;
  netScore: number;
  confirmCount: number;
  denyCount: number;
}

export interface VoteRow {
  value: VoteValue;
  weight: number;
}

/** Sum a spot's votes into the denormalised tally fields. */
export function tallyVotes(votes: ReadonlyArray<VoteRow>): VoteTally {
  let confirmScore = 0;
  let denyScore = 0;
  let confirmCount = 0;
  let denyCount = 0;

  for (const v of votes) {
    if (v.value === 'CONFIRM') {
      confirmScore += v.weight;
      confirmCount += 1;
    } else {
      denyScore += v.weight;
      denyCount += 1;
    }
  }

  return {
    confirmScore,
    denyScore,
    netScore: confirmScore - denyScore,
    confirmCount,
    denyCount,
  };
}

/**
 * Resolve the spot's status after a recompute, given the current status and a
 * fresh tally. HIDE takes precedence over VERIFY. An admin override (REMOVED,
 * or a manually-restored/force-verified spot) is sticky — once a spot is
 * REMOVED it never auto-flips, and a spot already VERIFIED/HIDDEN by score
 * follows the thresholds below.
 *
 * Returns the next status; the caller decides whether to stamp verifiedAt /
 * hiddenAt (only on a transition INTO that state).
 */
export function resolveStatus(current: SpotStatus, tally: VoteTally): SpotStatus {
  // Admin hard-removal is terminal — votes never resurrect it.
  if (current === 'REMOVED') return 'REMOVED';

  // Hide takes precedence (safety first).
  if (tally.denyCount >= HIDE_DENY_COUNT) return 'HIDDEN';

  if (tally.netScore >= VERIFY_NET_SCORE) return 'VERIFIED';

  // Below both thresholds: a previously auto-verified/auto-hidden spot relaxes
  // back to UNVERIFIED (e.g. a vote was changed/removed). Admin-forced states
  // are handled by the admin actions, not here.
  return 'UNVERIFIED';
}
