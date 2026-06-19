/** Tally helper for the seed — mirrors apps/web/lib/verification.ts#tallyVotes. */
export function tallyVotesLike(
  votes: ReadonlyArray<{ value: 'CONFIRM' | 'DENY'; weight: number }>,
) {
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
    confirmScore: +confirmScore.toFixed(2),
    denyScore: +denyScore.toFixed(2),
    netScore: +(confirmScore - denyScore).toFixed(2),
    confirmCount,
    denyCount,
  };
}
