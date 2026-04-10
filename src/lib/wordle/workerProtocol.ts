import type { WorkerResponse } from './solverWorker';

export function isStaleWorkerResponse(msg: WorkerResponse, latestRequestId: number): boolean {
  return 'requestId' in msg && msg.requestId !== latestRequestId;
}

export function shouldCacheFirstGuess(requestedCandidateCount: number, initialCandidateCount: number): boolean {
  return requestedCandidateCount === initialCandidateCount;
}

/** When canonical candidates fall to this count or below, blend in broad candidates. */
export const BLEND_THRESHOLD = 20;

export function chooseCandidateSet(
  nextCanonical: string[],
  nextBroad: string[],
  _pastAnswers?: Set<string>,
): { next: string[]; warning: string | null } {
  if (nextCanonical.length === 0 && nextBroad.length > 0) {
    return {
      next: nextBroad,
      warning: 'NYT picked a word outside the usual answer pool — switching to expanded vocabulary. The solver has adapted.',
    };
  }

  // When canonical candidates are few, blend in broad candidates so the solver
  // can distinguish non-canonical possibilities. NYT occasionally picks answers
  // from outside the curated ~2,300 answer pool (e.g., CAROM, MOOCH).
  // Non-canonical words get a reduced weight via computeWeights.
  if (nextCanonical.length > 0 && nextCanonical.length <= BLEND_THRESHOLD) {
    const canonicalSet = new Set(nextCanonical);
    const extra = nextBroad.filter(w => !canonicalSet.has(w));
    if (extra.length > 0) {
      return {
        next: [...nextCanonical, ...extra],
        warning: null,
      };
    }
  }

  // Note: past-answer fallback removed — NYT reuses past answers (since ~Feb 2026),
  // so past answers are valid candidates with reduced weight.

  return { next: nextCanonical, warning: null };
}
