# Benchmark Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI benchmark that plays all historical Wordle games, measures solver performance, and outputs results for a visual dashboard — enabling iterative weight tuning.

**Architecture:** A TypeScript CLI script imports the solver's pure functions directly (no Web Worker). It iterates through the API-verified answer history, accumulates past-answer knowledge per game, and writes structured JSON results. A standalone HTML dashboard loads these result files for visualization and comparison. Weight configs are separate JSON files so experiments are reproducible.

**Tech Stack:** TypeScript (tsx), Node.js test runner, Chart.js (CDN), standalone HTML

---

### Task 1: Weight Config Schema & Baseline Config

**Files:**
- Create: `benchmark/configs/baseline-v1.json`
- Create: `scripts/benchmark-types.ts`

**Step 1: Create the types file**

```typescript
// scripts/benchmark-types.ts

export interface WeightConfig {
  name: string;
  pastAnswer: {
    usedOnce: number;
    usedTwice: number;
  };
  frequencyWeightRange: [number, number];
  seasonalBoostEnabled: boolean;
}

export interface GameResult {
  gameIndex: number;
  answer: string;
  guesses: string[];
  guessCount: number;
  solved: boolean;
  pastAnswersKnown: number;
  answerWasPastReuse: boolean;
}

export interface BenchmarkSummary {
  totalGames: number;
  solved: number;
  failed: number;
  solveRate: number;
  averageGuesses: number;
  medianGuesses: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number; fail: number };
  byEra: {
    preReuse: { games: number; averageGuesses: number; solveRate: number };
    reuse: { games: number; averageGuesses: number; solveRate: number };
  };
  byAnswerType: {
    newWord: { games: number; averageGuesses: number };
    reusedAnswer: { games: number; averageGuesses: number };
  };
}

export interface BenchmarkResult {
  timestamp: string;
  config: WeightConfig;
  summary: BenchmarkSummary;
  games: GameResult[];
  durationMs: number;
  quick: boolean;
}
```

**Step 2: Create the baseline config**

```json
{
  "name": "baseline-v1",
  "pastAnswer": {
    "usedOnce": 0.04,
    "usedTwice": 0.01
  },
  "frequencyWeightRange": [0.2, 1.0],
  "seasonalBoostEnabled": true
}
```

**Step 3: Create directories**

Run: `mkdir -p benchmark/configs benchmark/results`

**Step 4: Commit**

```bash
git add scripts/benchmark-types.ts benchmark/configs/baseline-v1.json
git commit -m "feat: add benchmark types and baseline weight config"
```

---

### Task 2: Core Game Simulation Function

**Files:**
- Create: `scripts/benchmark-engine.ts`
- Test: `scripts/benchmark-engine.test.ts`

**Step 1: Write the failing test**

```typescript
// scripts/benchmark-engine.test.ts
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
  // Use a word not in POSSIBLE_WORDS to force failure — "zzzzz" is not valid,
  // so we test with a config that gives everything weight 0 except the answer.
  // Actually, just verify the result has guessCount <= 6.
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
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/benchmark-engine.test.ts`
Expected: FAIL — `playGame` not found

**Step 3: Write the engine**

```typescript
// scripts/benchmark-engine.ts
import { feedbackPattern } from '../src/lib/wordle/feedback';
import { filterCandidatesByFeedback } from '../src/lib/wordle/solver';
import { bestNextGuessHeuristic } from '../src/lib/wordle/solver_fast';
import { frequencyWeights } from '../src/lib/wordle/wordFrequency';
import { seasonalBoosts } from '../src/lib/wordle/seasonalBoost';
import type { WeightConfig, GameResult } from './benchmark-types';

const MAX_GUESSES = 6;

export function computeWeights(
  candidates: readonly string[],
  pastCounts: Map<string, number>,
  config: WeightConfig,
): number[] {
  const freqW = frequencyWeights(candidates);
  const seasonal = config.seasonalBoostEnabled ? seasonalBoosts(candidates) : candidates.map(() => 1);
  const [minFreq, maxFreq] = config.frequencyWeightRange;

  return candidates.map((word, i) => {
    const useCount = pastCounts.get(word) ?? 0;
    let pastFactor: number;
    if (useCount === 0) pastFactor = 1.0;
    else if (useCount === 1) pastFactor = config.pastAnswer.usedOnce;
    else pastFactor = config.pastAnswer.usedTwice;

    // Remap frequency weight to config range
    const rawFreq = freqW[i];
    // frequencyWeights already maps to [0.2, 1.0]; remap to config range
    const normalizedFreq = (rawFreq - 0.2) / 0.8; // 0..1
    const freq = minFreq + normalizedFreq * (maxFreq - minFreq);

    return pastFactor * freq * seasonal[i];
  });
}

export function playGame(opts: {
  answer: string;
  gameIndex: number;
  pastCounts: Map<string, number>;
  allCandidates: readonly string[];
  allowedGuesses: readonly string[];
  config: WeightConfig;
  quick?: boolean;
}): GameResult {
  const { answer, gameIndex, pastCounts, allCandidates, allowedGuesses, config, quick } = opts;

  let candidates = [...allCandidates];
  const guesses: string[] = [];
  const answerWasPastReuse = (pastCounts.get(answer) ?? 0) > 0;

  for (let round = 1; round <= MAX_GUESSES; round++) {
    const weights = computeWeights(candidates, pastCounts, config);
    const { guess } = bestNextGuessHeuristic({
      candidates,
      weights,
      allowedGuesses,
      finishThreshold: 50,
      shortlistSize: quick ? 500 : 2500,
      lookaheadThreshold: quick ? 0 : 200,
    });

    guesses.push(guess);

    if (guess === answer) {
      return {
        gameIndex,
        answer,
        guesses,
        guessCount: round,
        solved: true,
        pastAnswersKnown: pastCounts.size,
        answerWasPastReuse,
      };
    }

    const pattern = feedbackPattern(guess, answer);
    candidates = filterCandidatesByFeedback({ candidates, guess, pattern });

    if (candidates.length === 0) break;
  }

  return {
    gameIndex,
    answer,
    guesses,
    guessCount: MAX_GUESSES,
    solved: false,
    pastAnswersKnown: pastCounts.size,
    answerWasPastReuse,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/benchmark-engine.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add scripts/benchmark-engine.ts scripts/benchmark-engine.test.ts
git commit -m "feat: add core game simulation engine for benchmark"
```

---

### Task 3: Summary Stats Calculator

**Files:**
- Create: `scripts/benchmark-stats.ts`
- Test: `scripts/benchmark-stats.test.ts`

**Step 1: Write the failing test**

```typescript
// scripts/benchmark-stats.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSummary } from './benchmark-stats';
import type { GameResult } from './benchmark-types';

const REUSE_ERA_START = 1688; // Feb 1, 2026

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
    makeGame(1700, 'cigar', 2, true, true),  // reuse era, reused answer
  ];

  const summary = computeSummary(games);
  assert.equal(summary.totalGames, 5);
  assert.equal(summary.solved, 4);
  assert.equal(summary.failed, 1);
  assert.equal(summary.solveRate, 0.8);
  // Average of solved games: (3+4+5+2)/4 = 3.5, unsolved counts as 7: (3+4+5+7+2)/5 = 4.2
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
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/benchmark-stats.test.ts`
Expected: FAIL — `computeSummary` not found

**Step 3: Write the implementation**

```typescript
// scripts/benchmark-stats.ts
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
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/benchmark-stats.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/benchmark-stats.ts scripts/benchmark-stats.test.ts
git commit -m "feat: add summary stats calculator for benchmark"
```

---

### Task 4: Benchmark CLI Script

**Files:**
- Create: `scripts/benchmark.ts`
- Modify: `package.json` (add `benchmark` and `benchmark:quick` scripts)

**Step 1: Write the CLI script**

```typescript
// scripts/benchmark.ts
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
      pastCounts: new Map(pastCounts), // snapshot
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
```

**Step 2: Add npm scripts to package.json**

Add to `"scripts"`:
```json
"benchmark": "tsx scripts/benchmark.ts",
"benchmark:quick": "tsx scripts/benchmark.ts --quick"
```

**Step 3: Run a quick smoke test**

Run: `npm run benchmark:quick`
Expected: Completes in ~1-2 minutes, prints summary stats, writes a result file.

**Step 4: Commit**

```bash
git add scripts/benchmark.ts package.json
git commit -m "feat: add benchmark CLI with quick and full modes"
```

---

### Task 5: Dashboard HTML

**Files:**
- Create: `benchmark/dashboard.html`

**Step 1: Create the dashboard**

This is a single self-contained HTML file. It uses Chart.js from CDN for charts. The three views (run summary, run comparison, evolution timeline) are tab-switched sections.

Key behaviors:
- File picker / drag-drop to load result JSON files
- **Run summary tab**: histogram of guess distribution (bar chart), stats table, config display
- **Comparison tab**: select two loaded runs, overlay histograms (grouped bar chart), delta stats table, table of games that changed
- **Timeline tab**: line chart of average guesses across all loaded runs sorted by timestamp, hover for config details

Implementation notes:
- Use `<input type="file" multiple>` for loading result files
- Store loaded results in a JS array in memory
- Chart.js bar chart for histograms, line chart for timeline
- All rendering is vanilla JS — no framework needed
- Style with minimal inline CSS (dark theme to match the app)

The file will be ~400-500 lines of HTML/JS/CSS. Write it as a complete, working standalone file.

**Step 2: Test manually**

Run: `npm run benchmark:quick` (if no result file exists yet)
Then: Open `benchmark/dashboard.html` in a browser, load the result file, verify all three tabs render.

**Step 3: Commit**

```bash
git add benchmark/dashboard.html
git commit -m "feat: add benchmark dashboard with summary, comparison, and timeline views"
```

---

### Task 6: Integration Test — Full Round Trip

**Files:**
- Create: `scripts/benchmark-integration.test.ts`

**Step 1: Write the integration test**

This test runs a small benchmark (first 20 games) and validates the full pipeline: config loading, game simulation, stats computation, and result structure.

```typescript
// scripts/benchmark-integration.test.ts
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
```

**Step 2: Run the test**

Run: `npx tsx --test scripts/benchmark-integration.test.ts`
Expected: PASS

**Step 3: Add benchmark tests to npm test script**

Modify `package.json` `"test"` script to also run benchmark tests:
```json
"test": "tsx --test src/**/*.test.ts && tsx --test scripts/benchmark-*.test.ts && node --test scripts/*.test.mjs"
```

Note: the integration test takes ~10-15 seconds (20 solver calls). This is acceptable for CI.

**Step 4: Run full test suite**

Run: `npm run test`
Expected: All tests pass (existing + new benchmark tests)

**Step 5: Commit**

```bash
git add scripts/benchmark-integration.test.ts package.json
git commit -m "feat: add benchmark integration test and wire into test suite"
```

---

### Task 7: Update CLAUDE.md & Add .gitignore for Results

**Files:**
- Modify: `CLAUDE.md`
- Create: `benchmark/results/.gitignore`

**Step 1: Add results gitignore**

```
# Benchmark result files are local — not committed
*
!.gitignore
```

**Step 2: Update CLAUDE.md**

Add under the `## Commands` section:
```
- `npm run benchmark` — full benchmark: play all historical games (~5-15 min)
- `npm run benchmark:quick` — quick benchmark: skip lookahead (~1-2 min)
```

Add a new `### Benchmark` subsection under `## Architecture`:
```
### Benchmark

CLI harness (`scripts/benchmark.ts`) plays all historical Wordle games using the solver and measures performance. Weight configs in `benchmark/configs/` define tunable parameters. Results are written to `benchmark/results/` (gitignored). Dashboard at `benchmark/dashboard.html` visualizes results.

Key files:
- `scripts/benchmark.ts` — CLI entry point
- `scripts/benchmark-engine.ts` — core game simulation loop
- `scripts/benchmark-stats.ts` — summary statistics calculator
- `scripts/benchmark-types.ts` — shared TypeScript types
- `benchmark/configs/` — weight config JSON files
- `benchmark/results/` — output result JSON files (gitignored)
- `benchmark/dashboard.html` — standalone visualization dashboard
```

**Step 3: Commit**

```bash
git add CLAUDE.md benchmark/results/.gitignore
git commit -m "docs: add benchmark documentation and gitignore for results"
```

---

## Task Summary

| Task | Description | Estimated Time |
|------|-------------|---------------|
| 1 | Weight config schema & baseline config | 5 min |
| 2 | Core game simulation function + tests | 15 min |
| 3 | Summary stats calculator + tests | 10 min |
| 4 | Benchmark CLI script + npm scripts | 10 min |
| 5 | Dashboard HTML (standalone) | 30 min |
| 6 | Integration test + test suite wiring | 10 min |
| 7 | CLAUDE.md updates & gitignore | 5 min |

**Total: ~85 min of implementation + first benchmark run**

After Task 4, run `npm run benchmark` for the first full baseline measurement. This gives you the number to beat as you start tuning weights.
