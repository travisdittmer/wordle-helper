import type { WorkerResponse } from './solverWorker';

export function isStaleWorkerResponse(msg: WorkerResponse, latestRequestId: number): boolean {
  return 'requestId' in msg && msg.requestId !== latestRequestId;
}

export function shouldCacheFirstGuess(requestedCandidateCount: number, initialCandidateCount: number): boolean {
  return requestedCandidateCount === initialCandidateCount;
}
