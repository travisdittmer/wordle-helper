import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkerResponse } from './solverWorker';
import { chooseCandidateSet, isStaleWorkerResponse, shouldCacheFirstGuess } from './workerProtocol';

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

test('chooseCandidateSet falls back to broad list for stale canonical list (POOCH/MOOCH case)', () => {
  const res1 = chooseCandidateSet(['pooch'], ['pooch', 'mooch']);
  assert.deepEqual(res1.next, ['pooch', 'mooch']);
  assert.ok(res1.warning);

  const res2 = chooseCandidateSet([], ['mooch']);
  assert.deepEqual(res2.next, ['mooch']);
  assert.ok(res2.warning);

  const res3 = chooseCandidateSet(['mooch', 'pooch'], ['mooch', 'pooch']);
  assert.deepEqual(res3.next, ['mooch', 'pooch']);
  assert.equal(res3.warning, null);
});

// --- Bug fix: past-answer awareness ---

test('chooseCandidateSet falls back to broad when all canonical candidates are past answers', () => {
  const pastAnswers = new Set(['jolly', 'golly']);

  // Canonical has 2 words but both are past answers; broad has non-past words
  const res = chooseCandidateSet(['jolly', 'golly'], ['jolly', 'golly', 'molly', 'polly'], pastAnswers);
  assert.deepEqual(res.next, ['jolly', 'golly', 'molly', 'polly']);
  assert.ok(res.warning);
  assert.ok(res.warning!.includes('past'));
});

test('chooseCandidateSet returns canonical when it has active (non-past) candidates', () => {
  const pastAnswers = new Set(['jolly']);

  // Canonical has jolly (past) + molly (active) — should NOT fall back
  const res = chooseCandidateSet(['jolly', 'molly'], ['jolly', 'molly', 'polly'], pastAnswers);
  assert.deepEqual(res.next, ['jolly', 'molly']);
  assert.equal(res.warning, null);
});

test('chooseCandidateSet without pastAnswers preserves existing behavior', () => {
  // No pastAnswers arg = same as before
  const res = chooseCandidateSet(['jolly', 'golly'], ['jolly', 'golly', 'molly']);
  assert.deepEqual(res.next, ['jolly', 'golly']);
  assert.equal(res.warning, null);
});

test('chooseCandidateSet falls back when all canonical AND broad are past answers', () => {
  const pastAnswers = new Set(['jolly', 'golly']);

  // Both canonical and broad are all past answers — falls back to broad (let caller handle the 0-active case)
  const res = chooseCandidateSet(['jolly'], ['jolly', 'golly'], pastAnswers);
  assert.deepEqual(res.next, ['jolly', 'golly']);
  assert.ok(res.warning);
});
