import assert from 'node:assert/strict';
import test from 'node:test';
import { ALLOWED_WORDS, POSSIBLE_WORDS } from '@/lib/wordlists';
import { feedbackPattern } from './feedback';
import { bestNextGuessHeuristic } from './solver_fast';

const allowedGuesses = Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS]));

// The _IGHT trap from the 2026-09-23 review: NIGHT, LIGHT, MIGHT, RIGHT all BGGGG.
// Weights mirror production: unused curated 1.0, past answers 0.04, outside-pool words 0.1.
const TURN5_CANDIDATES = ['eight', 'fight', 'sight', 'tight', 'wight', 'aight', 'bight', 'dight', 'hight', 'kight', 'pight'];
const TURN5_WEIGHTS = [0.04, 1, 0.04, 1, 1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
// ...then SIGHT also BGGGG.
const TURN6_CANDIDATES = TURN5_CANDIDATES.filter((w) => w !== 'sight');
const TURN6_WEIGHTS = TURN5_WEIGHTS.filter((_, i) => TURN5_CANDIDATES[i] !== 'sight');

/** P(win within two guesses | guess g, then the most likely word in its feedback bucket). */
function twoGuessWinChance(g: string, candidates: string[], weights: number[]): number {
  const bestInBucket = new Map<string, number>();
  candidates.forEach((a, i) => {
    const p = feedbackPattern(g, a);
    bestInBucket.set(p, Math.max(bestInBucket.get(p) ?? 0, weights[i]));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return [...bestInBucket.values()].reduce((a, b) => a + b, 0) / total;
}

test('with one guess left, recommends the most likely answer instead of a probe', () => {
  const { guess } = bestNextGuessHeuristic({
    candidates: TURN6_CANDIDATES,
    weights: TURN6_WEIGHTS,
    allowedGuesses,
    turnsLeft: 1,
  });
  assert.ok(['fight', 'tight', 'wight'].includes(guess), `expected a 27.5% candidate, got ${guess}`);
});

test('with two guesses left, maximizes the chance of winning within both', () => {
  const { guess } = bestNextGuessHeuristic({
    candidates: TURN5_CANDIDATES,
    weights: TURN5_WEIGHTS,
    allowedGuesses,
    turnsLeft: 2,
  });
  const chosen = twoGuessWinChance(guess, TURN5_CANDIDATES, TURN5_WEIGHTS);
  const best = Math.max(...allowedGuesses.map((g) => twoGuessWinChance(g, TURN5_CANDIDATES, TURN5_WEIGHTS)));
  assert.ok(chosen >= best - 1e-12, `${guess} wins ${chosen.toFixed(4)} within two guesses; best is ${best.toFixed(4)}`);
});

test('with two guesses left, prefers a candidate when it is as safe as any probe', () => {
  // Any of the three can be guessed first; if it misses, the feedback identifies the answer.
  const candidates = ['cigar', 'rebut', 'sissy'];
  const { guess } = bestNextGuessHeuristic({ candidates, weights: [1, 1, 1], allowedGuesses, turnsLeft: 2 });
  assert.ok(candidates.includes(guess), `expected a candidate, got ${guess}`);
});
