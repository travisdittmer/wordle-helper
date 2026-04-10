import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkerResponse } from './solverWorker';
import { BLEND_THRESHOLD, chooseCandidateSet, isStaleWorkerResponse, shouldCacheFirstGuess } from './workerProtocol';

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

test('chooseCandidateSet falls back to broad list when canonical is empty', () => {
  const res1 = chooseCandidateSet([], ['mooch']);
  assert.deepEqual(res1.next, ['mooch']);
  assert.ok(res1.warning);
});

test('chooseCandidateSet blends broad candidates when canonical is small', () => {
  // Single canonical candidate — blends in extra broad candidates
  const res = chooseCandidateSet(['pooch'], ['pooch', 'mooch']);
  assert.deepEqual(res.next, ['pooch', 'mooch']);
  assert.equal(res.warning, null);

  // When canonical equals broad, no extra to blend
  const res2 = chooseCandidateSet(['mooch', 'pooch'], ['mooch', 'pooch']);
  assert.deepEqual(res2.next, ['mooch', 'pooch']);
  assert.equal(res2.warning, null);
});

test('chooseCandidateSet does not blend when canonical exceeds threshold', () => {
  // Build canonical list larger than BLEND_THRESHOLD
  const canonical = Array.from({ length: BLEND_THRESHOLD + 1 }, (_, i) => `word${i}`);
  const broad = [...canonical, 'extra1', 'extra2'];

  const res = chooseCandidateSet(canonical, broad);
  assert.deepEqual(res.next, canonical);
  assert.equal(res.warning, null);
});

// --- Past answers are now valid candidates (NYT reuses since ~Feb 2026) ---

test('chooseCandidateSet blends broad when canonical (all past answers) is small', () => {
  const pastAnswers = new Set(['jolly', 'golly']);

  // Small canonical set — blends in extra broad candidates
  const res = chooseCandidateSet(['jolly', 'golly'], ['jolly', 'golly', 'molly', 'polly'], pastAnswers);
  assert.deepEqual(res.next, ['jolly', 'golly', 'molly', 'polly']);
  assert.equal(res.warning, null);
});

test('chooseCandidateSet blends broad with mixed past/active canonical candidates', () => {
  const pastAnswers = new Set(['jolly']);

  const res = chooseCandidateSet(['jolly', 'molly'], ['jolly', 'molly', 'polly'], pastAnswers);
  assert.deepEqual(res.next, ['jolly', 'molly', 'polly']);
  assert.equal(res.warning, null);
});
