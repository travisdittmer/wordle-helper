import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSummary } from './benchmark-stats';
import type { GameResult } from './benchmark-types';

const makeGame = (idx: number, answer: string, count: number, solved: boolean, reuse: boolean): GameResult => ({
  gameIndex: idx,
  answer,
  guesses: Array(count).fill('xxxxx'),
  guessCount: count,
  solved,
  pastAnswersKnown: idx,
  answerWasPastReuse: reuse,
});

test('computeSummary calculates correct stats', () => {
  const games: GameResult[] = [
    makeGame(0, 'cigar', 3, true, false),
    makeGame(1, 'rebut', 4, true, false),
    makeGame(2, 'sissy', 5, true, false),
    makeGame(3, 'humph', 6, false, false),
    makeGame(1700, 'cigar', 2, true, true),
  ];

  const summary = computeSummary(games);
  assert.equal(summary.totalGames, 5);
  assert.equal(summary.solved, 4);
  assert.equal(summary.failed, 1);
  assert.equal(summary.solveRate, 0.8);
  // Average: (3+4+5+7+2)/5 = 4.2
  assert.equal(summary.averageGuesses, 4.2);
  assert.equal(summary.distribution[3], 1);
  assert.equal(summary.distribution[4], 1);
  assert.equal(summary.distribution[5], 1);
  assert.equal(summary.distribution.fail, 1);
  assert.equal(summary.distribution[2], 1);
  assert.equal(summary.byEra.preReuse.games, 4);
  assert.equal(summary.byEra.reuse.games, 1);
  assert.equal(summary.byAnswerType.reusedAnswer.games, 1);
  assert.equal(summary.byAnswerType.newWord.games, 4);
});
