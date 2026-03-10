import type { WorkerResponse } from './solverWorker';

export function isStaleWorkerResponse(msg: WorkerResponse, latestRequestId: number): boolean {
  return 'requestId' in msg && msg.requestId !== latestRequestId;
}

export function shouldCacheFirstGuess(requestedCandidateCount: number, initialCandidateCount: number): boolean {
  return requestedCandidateCount === initialCandidateCount;
}

export function chooseCandidateSet(
  nextCanonical: string[],
  nextBroad: string[],
  _pastAnswers?: Set<string>,
): { next: string[]; warning: string | null } {
  if (nextCanonical.length === 0 && nextBroad.length > 0) {
    return {
      next: nextBroad,
      warning: 'Candidate list appears stale; using broader allowed-word matches. Consider refreshing possible_words.txt.',
    };
  }

  // Note: past-answer fallback removed — NYT reuses past answers (since ~Feb 2026),
  // so past answers are valid candidates with reduced weight.

  return { next: nextCanonical, warning: null };
}
