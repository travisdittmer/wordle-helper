import fs from 'node:fs';
import path from 'node:path';
import { ANSWERS_BY_DATE } from '../src/lib/wordle/answersByDate';
import { POSSIBLE_WORDS, ALLOWED_WORDS } from '../src/lib/wordlists';
import { playGame } from './benchmark-engine';
import { computeSummary } from './benchmark-stats';
import type { WeightConfig, GameResult, BenchmarkResult } from './benchmark-types';

const root = process.cwd();
const resultsDir = path.join(root, 'benchmark', 'results');

function loadConfig(configPath: string): WeightConfig {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as WeightConfig;
}

function formatTimestamp(): string {
  const d = new Date();
  return d.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
}

function main() {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const configArg = args.find(a => a.startsWith('--config='));
  const configPath = configArg
    ? configArg.split('=')[1]
    : path.join(root, 'benchmark', 'configs', 'baseline-v1.json');

  const config = loadConfig(configPath);
  console.log(`Benchmark: "${config.name}" ${quick ? '(quick mode)' : '(full mode)'}`);
  console.log(`Games: ${ANSWERS_BY_DATE.length}`);
  console.log('');

  const allCandidates = [...POSSIBLE_WORDS];
  const allowedGuesses = Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS]));

  const t0 = performance.now();
  const games: GameResult[] = [];
  const pastCounts = new Map<string, number>();

  for (let i = 0; i < ANSWERS_BY_DATE.length; i++) {
    const answer = ANSWERS_BY_DATE[i];

    const result = playGame({
      answer,
      gameIndex: i,
      pastCounts: new Map(pastCounts),
      allCandidates,
      allowedGuesses,
      config,
      quick,
    });

    games.push(result);

    // Accumulate past-answer knowledge
    pastCounts.set(answer, (pastCounts.get(answer) ?? 0) + 1);

    // Progress
    if ((i + 1) % 100 === 0 || i === ANSWERS_BY_DATE.length - 1) {
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      const pct = ((i + 1) / ANSWERS_BY_DATE.length * 100).toFixed(0);
      process.stdout.write(`\r  ${i + 1}/${ANSWERS_BY_DATE.length} (${pct}%) — ${elapsed}s`);
    }
  }

  const durationMs = Math.round(performance.now() - t0);
  console.log(`\n\nDone in ${(durationMs / 1000).toFixed(1)}s\n`);

  const summary = computeSummary(games);

  // Print summary
  console.log(`Solve rate: ${(summary.solveRate * 100).toFixed(1)}% (${summary.solved}/${summary.totalGames})`);
  console.log(`Average guesses: ${summary.averageGuesses.toFixed(3)} (median: ${summary.medianGuesses})`);
  console.log(`Distribution: 1=${summary.distribution[1]} 2=${summary.distribution[2]} 3=${summary.distribution[3]} 4=${summary.distribution[4]} 5=${summary.distribution[5]} 6=${summary.distribution[6]} fail=${summary.distribution.fail}`);
  console.log('');
  console.log(`Pre-reuse era: avg=${summary.byEra.preReuse.averageGuesses.toFixed(3)} solve=${(summary.byEra.preReuse.solveRate * 100).toFixed(1)}% (${summary.byEra.preReuse.games} games)`);
  console.log(`Reuse era:     avg=${summary.byEra.reuse.averageGuesses.toFixed(3)} solve=${(summary.byEra.reuse.solveRate * 100).toFixed(1)}% (${summary.byEra.reuse.games} games)`);
  if (summary.byAnswerType.reusedAnswer.games > 0) {
    console.log(`Reused answers: avg=${summary.byAnswerType.reusedAnswer.averageGuesses.toFixed(3)} (${summary.byAnswerType.reusedAnswer.games} games)`);
  }

  // Save result
  fs.mkdirSync(resultsDir, { recursive: true });
  const filename = `${formatTimestamp()}_${config.name}.json`;
  const resultPath = path.join(resultsDir, filename);

  const result: BenchmarkResult = {
    timestamp: new Date().toISOString(),
    config,
    summary,
    games,
    durationMs,
    quick,
  };

  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nResults saved: benchmark/results/${filename}`);
}

main();
