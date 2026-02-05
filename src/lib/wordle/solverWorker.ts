import { ALLOWED_WORDS, POSSIBLE_WORDS } from '@/lib/wordlists';
import { bestNextGuessHeuristic } from './solver_fast';

export type WorkerRequest =
  | { type: 'compute'; candidates: string[] }
  | { type: 'ping' };

export type WorkerResponse =
  | { type: 'result'; guess: string; score: number; tookMs: number }
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
  const { guess, score } = bestNextGuessHeuristic({
    candidates: msg.candidates,
    allowedGuesses,
    finishThreshold: 15,
    shortlistSize: 2500,
  });
  const tookMs = performance.now() - t0;
  self.postMessage({ type: 'result', guess, score, tookMs } satisfies WorkerResponse);
};
