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
  pastAnswers?: Set<string>,
): { next: string[]; warning: string | null } {
  if (nextCanonical.length === 0 && nextBroad.length > 0) {
    return {
      next: nextBroad,
      warning: 'Candidate list appears stale; using broader allowed-word matches. Consider refreshing possible_words.txt.',
    };
  }

  // When all canonical candidates are past Wordle answers, fall back to broad
  // so the solver can find non-past-answer candidates.
  if (pastAnswers && nextCanonical.length > 0) {
    const activeCanonical = nextCanonical.filter(w => !pastAnswers.has(w));
    if (activeCanonical.length === 0 && nextBroad.length > 0) {
      return {
        next: nextBroad,
        warning: 'Only past Wordle answers match the canonical list; using broader allowed-word matches.',
      };
    }
  }

  if (nextCanonical.length === 1 && nextBroad.length > 1) {
    return {
      next: nextBroad,
      warning: 'Canonical candidate list may be missing current answers; using broader allowed-word matches.',
    };
  }

  return { next: nextCanonical, warning: null };
}
