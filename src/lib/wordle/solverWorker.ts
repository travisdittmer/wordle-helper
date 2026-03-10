import { ALLOWED_WORDS, POSSIBLE_WORDS } from '@/lib/wordlists';
import { pastAnswerCounts, pastAnswerWeight } from './history';
import { bestNextGuessHeuristic } from './solver_fast';

export type WorkerRequest =
  | { type: 'compute'; requestId: number; candidates: string[] }
  | { type: 'ping' };

export type WorkerResponse =
  | { type: 'result'; requestId: number; guess: string; score: number; tookMs: number }
  | { type: 'error'; requestId: number; message: string }
  | { type: 'pong' };

const allowedGuesses = Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS]));

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'ping') {
    self.postMessage({ type: 'pong' } satisfies WorkerResponse);
    return;
  }
  if (msg.type !== 'compute') return;

  const t0 = performance.now();

  try {
    const counts = pastAnswerCounts(new Date());

    // Past-answer weight only — benchmark showed frequency and seasonal priors hurt performance.
    const weights = msg.candidates.map((w) => {
      return pastAnswerWeight(counts.get(w) ?? 0);
    });

    const { guess, score } = bestNextGuessHeuristic({
      candidates: msg.candidates,
      weights,
      allowedGuesses,
      finishThreshold: 50,
      shortlistSize: 2500,
    });
    const tookMs = performance.now() - t0;
    self.postMessage({ type: 'result', requestId: msg.requestId, guess, score, tookMs } satisfies WorkerResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown worker error';
    self.postMessage({ type: 'error', requestId: msg.requestId, message } satisfies WorkerResponse);
  }
};
