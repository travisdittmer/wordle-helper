import type { GameResult, BenchmarkSummary } from './benchmark-types';

const REUSE_ERA_START = 1688; // Game index for Feb 1, 2026
const FAIL_PENALTY = 7; // Unsolved games count as 7 guesses for averaging

export function computeSummary(games: GameResult[]): BenchmarkSummary {
  const solved = games.filter(g => g.solved);
  const failed = games.filter(g => !g.solved);

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, fail: 0 } as BenchmarkSummary['distribution'];
  for (const g of games) {
    if (g.solved) dist[g.guessCount as 1 | 2 | 3 | 4 | 5 | 6]++;
    else dist.fail++;
  }

  const guessValues = games.map(g => g.solved ? g.guessCount : FAIL_PENALTY);
  const avg = guessValues.reduce((a, b) => a + b, 0) / games.length;

  const sortedGuesses = [...guessValues].sort((a, b) => a - b);
  const mid = Math.floor(sortedGuesses.length / 2);
  const median = sortedGuesses.length % 2 === 0
    ? (sortedGuesses[mid - 1] + sortedGuesses[mid]) / 2
    : sortedGuesses[mid];

  const preReuse = games.filter(g => g.gameIndex < REUSE_ERA_START);
  const reuseEra = games.filter(g => g.gameIndex >= REUSE_ERA_START);
  const newWord = games.filter(g => !g.answerWasPastReuse);
  const reused = games.filter(g => g.answerWasPastReuse);

  function subsetStats(subset: GameResult[]) {
    if (subset.length === 0) return { games: 0, averageGuesses: 0, solveRate: 0 };
    const vals = subset.map(g => g.solved ? g.guessCount : FAIL_PENALTY);
    return {
      games: subset.length,
      averageGuesses: Math.round((vals.reduce((a, b) => a + b, 0) / subset.length) * 1000) / 1000,
      solveRate: Math.round((subset.filter(g => g.solved).length / subset.length) * 1000) / 1000,
    };
  }

  return {
    totalGames: games.length,
    solved: solved.length,
    failed: failed.length,
    solveRate: Math.round((solved.length / games.length) * 1000) / 1000,
    averageGuesses: Math.round(avg * 1000) / 1000,
    medianGuesses: median,
    distribution: dist,
    byEra: {
      preReuse: subsetStats(preReuse),
      reuse: subsetStats(reuseEra),
    },
    byAnswerType: {
      newWord: subsetStats(newWord),
      reusedAnswer: subsetStats(reused),
    },
  };
}
