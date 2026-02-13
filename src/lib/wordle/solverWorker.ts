import { ALLOWED_WORDS, POSSIBLE_WORDS } from '@/lib/wordlists';
import { knownPastAnswers } from './history';
import { bestNextGuessHeuristic } from './solver_fast';

export type WorkerRequest =
  | { type: 'compute'; requestId: number; candidates: string[]; pastAnswerWeight?: number }
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
    const pastWeight = Math.max(0, Math.min(1, msg.pastAnswerWeight ?? 0.05));
    const past = knownPastAnswers(new Date());
    const weights = msg.candidates.map((w) => (past.has(w) ? pastWeight : 1));

    const { guess, score } = bestNextGuessHeuristic({
      candidates: msg.candidates,
      weights,
      allowedGuesses,
      finishThreshold: 15,
      shortlistSize: 2500,
    });
    const tookMs = performance.now() - t0;
    self.postMessage({ type: 'result', requestId: msg.requestId, guess, score, tookMs } satisfies WorkerResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown worker error';
    self.postMessage({ type: 'error', requestId: msg.requestId, message } satisfies WorkerResponse);
  }
};
