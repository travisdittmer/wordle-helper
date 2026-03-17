import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeGuess } from './analysis';

test('analyzeGuess: 2 candidates with equal weights', () => {
  const result = analyzeGuess('grade', ['grade', 'trade'], [1.0, 1.0]);
  assert.equal(result.partitions.length, 2);
  assert.equal(result.solveChance, 0.5);
  assert.equal(result.expectedRemaining, 1);
  assert.equal(result.worstCase, 1);
  const patterns = result.partitions.map(p => p.pattern);
  assert.ok(patterns.includes('GGGGG'));
  assert.ok(patterns.includes('BGGGG'));
  const solveBucket = result.partitions.find(p => p.pattern === 'GGGGG')!;
  assert.deepEqual(solveBucket.candidates, ['grade']);
  assert.equal(solveBucket.totalWeight, 1.0);
});

test('analyzeGuess: probe word (not a candidate)', () => {
  const result = analyzeGuess('grate', ['grade', 'trade'], [1.0, 1.0]);
  assert.equal(result.solveChance, 0);
  assert.equal(result.partitions.length, 2);
  assert.equal(result.expectedRemaining, 1);
  assert.equal(result.worstCase, 1);
});

test('analyzeGuess: weighted candidates', () => {
  const result = analyzeGuess('grade', ['grade', 'trade'], [0.04, 1.0]);
  assert.ok(Math.abs(result.solveChance - 0.04 / 1.04) < 0.001);
  assert.equal(result.partitions[0].pattern, 'BGGGG');
  assert.equal(result.partitions[1].pattern, 'GGGGG');
});

test('analyzeGuess: many candidates produces correct partition count', () => {
  const candidates = ['grade', 'trade', 'crane', 'crate', 'trace'];
  const weights = [1, 1, 1, 1, 1];
  const result = analyzeGuess('raise', candidates, weights);
  assert.ok(result.partitions.length >= 1);
  assert.ok(result.partitions.length <= 5);
  const totalCandidates = result.partitions.reduce((sum, p) => sum + p.candidates.length, 0);
  assert.equal(totalCandidates, 5);
});

import { letterCoverage } from './analysis';
import type { Pattern } from './feedback';

test('letterCoverage: first guess has all new letters', () => {
  const result = letterCoverage('raise', []);
  assert.deepEqual(result.newLetters, ['r', 'a', 'i', 's', 'e']);
  assert.equal(result.retested.size, 0);
  assert.deepEqual(result.positionsProbed, [true, true, true, true, true]);
});

test('letterCoverage: second guess identifies retested and new letters', () => {
  const history = [{ guess: 'raise', pattern: 'YYBBG' as Pattern }];
  const result = letterCoverage('drape', history);
  assert.deepEqual(result.newLetters, ['d', 'p']);
  assert.ok(result.retested.has('r'));
  assert.ok(result.retested.has('a'));
  assert.ok(result.retested.has('e'));
  assert.equal(result.retested.get('r'), 'present');
  assert.equal(result.retested.get('a'), 'present');
  assert.equal(result.retested.get('e'), 'correct');
});

test('letterCoverage: positions with known greens are not new probes', () => {
  const history = [{ guess: 'raise', pattern: 'YYBBG' as Pattern }];
  const result = letterCoverage('drape', history);
  assert.equal(result.positionsProbed[4], false);
  assert.equal(result.positionsProbed[0], true);
});
