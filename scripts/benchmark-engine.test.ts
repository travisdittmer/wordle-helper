import assert from 'node:assert/strict';
import test from 'node:test';
import { playGame } from './benchmark-engine';
import { POSSIBLE_WORDS, ALLOWED_WORDS } from '../src/lib/wordlists';

const allCandidates = [...POSSIBLE_WORDS];
const allowedGuesses = Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS]));

const defaultConfig = {
  name: 'test',
  pastAnswer: { usedOnce: 0.04, usedTwice: 0.01 },
  frequencyWeightRange: [0.2, 1.0] as [number, number],
  seasonalBoostEnabled: true,
};

test('playGame solves CIGAR (game #0) with no past answers', () => {
  const result = playGame({
    answer: 'cigar',
    gameIndex: 0,
    pastCounts: new Map(),
    allCandidates,
    allowedGuesses,
    config: defaultConfig,
    quick: true,
  });
  assert.equal(result.solved, true);
  assert.ok(result.guessCount >= 1 && result.guessCount <= 6);
  assert.equal(result.guesses.length, result.guessCount);
  assert.equal(result.guesses[result.guessCount - 1], 'cigar');
  assert.equal(result.answer, 'cigar');
  assert.equal(result.pastAnswersKnown, 0);
  assert.equal(result.answerWasPastReuse, false);
});

test('playGame marks reused answer correctly', () => {
  const pastCounts = new Map([['cigar', 1], ['rebut', 1]]);
  const result = playGame({
    answer: 'cigar',
    gameIndex: 100,
    pastCounts,
    allCandidates,
    allowedGuesses,
    config: defaultConfig,
    quick: true,
  });
  assert.equal(result.answerWasPastReuse, true);
  assert.equal(result.pastAnswersKnown, 2);
});

test('playGame respects 6-guess limit', () => {
  const result = playGame({
    answer: 'cigar',
    gameIndex: 0,
    pastCounts: new Map(),
    allCandidates,
    allowedGuesses,
    config: defaultConfig,
    quick: true,
  });
  assert.ok(result.guessCount <= 6);
});
