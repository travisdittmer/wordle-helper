import assert from 'node:assert/strict';
import test from 'node:test';
import { ANSWERS_BY_DATE } from '../src/lib/wordle/answersByDate';
import { POSSIBLE_WORDS, ALLOWED_WORDS } from '../src/lib/wordlists';
import { playGame } from './benchmark-engine';
import { computeSummary } from './benchmark-stats';
import type { WeightConfig, GameResult } from './benchmark-types';

const config: WeightConfig = {
  name: 'integration-test',
  pastAnswer: { usedOnce: 0.04, usedTwice: 0.01 },
  frequencyWeightRange: [0.2, 1.0],
  seasonalBoostEnabled: true,
};

test('full benchmark pipeline: 20 games, quick mode', () => {
  const allCandidates = [...POSSIBLE_WORDS];
  const allowedGuesses = Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS]));
  const pastCounts = new Map<string, number>();
  const games: GameResult[] = [];

  for (let i = 0; i < 20; i++) {
    const answer = ANSWERS_BY_DATE[i];
    const result = playGame({
      answer,
      gameIndex: i,
      pastCounts: new Map(pastCounts),
      allCandidates,
      allowedGuesses,
      config,
      quick: true,
    });
    games.push(result);
    pastCounts.set(answer, (pastCounts.get(answer) ?? 0) + 1);
  }

  assert.equal(games.length, 20);

  // All games should have valid structure
  for (const g of games) {
    assert.ok(g.guessCount >= 1 && g.guessCount <= 6);
    assert.equal(typeof g.solved, 'boolean');
    assert.equal(g.guesses.length, g.guessCount);
    if (g.solved) assert.equal(g.guesses[g.guessCount - 1], g.answer);
  }

  // Summary should be valid
  const summary = computeSummary(games);
  assert.equal(summary.totalGames, 20);
  assert.ok(summary.averageGuesses >= 1 && summary.averageGuesses <= 7);
  assert.equal(summary.solved + summary.failed, 20);

  // Distribution should sum to 20
  const distTotal = summary.distribution[1] + summary.distribution[2] +
    summary.distribution[3] + summary.distribution[4] +
    summary.distribution[5] + summary.distribution[6] + summary.distribution.fail;
  assert.equal(distTotal, 20);

  // Past answer accumulation should work
  assert.equal(games[0].pastAnswersKnown, 0);
  assert.ok(games[19].pastAnswersKnown > 0);
});
