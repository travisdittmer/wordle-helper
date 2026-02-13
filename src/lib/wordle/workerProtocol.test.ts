import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkerResponse } from './solverWorker';
import { isStaleWorkerResponse, shouldCacheFirstGuess } from './workerProtocol';

test('isStaleWorkerResponse ignores pong and matches latest requestId', () => {
  const pong: WorkerResponse = { type: 'pong' };
  const ok: WorkerResponse = { type: 'result', requestId: 4, guess: 'raise', score: 5, tookMs: 12 };
  const stale: WorkerResponse = { type: 'result', requestId: 3, guess: 'slate', score: 5, tookMs: 13 };

  assert.equal(isStaleWorkerResponse(pong, 4), false);
  assert.equal(isStaleWorkerResponse(ok, 4), false);
  assert.equal(isStaleWorkerResponse(stale, 4), true);
});

test('shouldCacheFirstGuess only caches initial-candidate computation', () => {
  assert.equal(shouldCacheFirstGuess(2309, 2309), true);
  assert.equal(shouldCacheFirstGuess(17, 2309), false);
});
