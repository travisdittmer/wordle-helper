# Benchmark Harness & Dashboard Design

**Date:** 2026-03-10
**Status:** Approved
**Goal:** CLI benchmark harness + dashboard for measuring and tuning the Wordle solver's weighted strategy. Designed to enable a future autoresearch-style automated tuning loop (Approach 3).

## Background

The solver uses an entropy-based approach with weighted priors (past-answer penalty, word frequency, seasonal boosts). Since Feb 2026, NYT reuses past answers at ~11% rate, requiring weight tuning. Current weights (e.g., `pastAnswerWeight = 0.04` for used-once) are derived from probability math with 37 days of data. We need empirical measurement to validate and improve them.

### Strategy principles
- Optimize for future performance, not backtesting
- Use today's full candidate list (2344 words) for all simulated games
- Accumulate past-answer knowledge honestly per game (solver only knows what it would know at that point in time)
- Every day brings new data — the system should support iterative re-optimization

## Components

### 1. Benchmark Engine (`scripts/benchmark.ts`)

Plays all ~1725 historical games using the solver.

**Per-game loop:**
```
function playGame(answer, pastCounts, allCandidates, allowedGuesses):
  candidates = allCandidates
  for round 1..6:
    weights = computeWeights(candidates, pastCounts, config)
    guess = bestNextGuessHeuristic({ candidates, weights, allowedGuesses })
    if guess === answer: return { solved: true, guessCount: round }
    pattern = feedbackPattern(guess, answer)
    candidates = filterCandidatesByFeedback(candidates, guess, pattern)
  return { solved: false, guessCount: 6 }
```

**Simulation rules:**
- Uses today's full candidate list and allowed guesses for all games
- Accumulates past-answer knowledge per game: game N knows answers 0..N-1
- Uses today's frequency weights and seasonal boosts (fixed)
- Past-answer weights vary per game based on accumulated knowledge + config values

**Per-game record:**
```json
{
  "gameIndex": 500,
  "answer": "kayak",
  "guesses": ["roate", "lucky", "kayak"],
  "guessCount": 3,
  "solved": true,
  "pastAnswersKnown": 500,
  "answerWasPastReuse": false
}
```

**Summary stats:**
- Average guesses, median, solve rate
- Distribution: count of games solved in 1, 2, 3, 4, 5, 6, or failed
- Breakdown by era (pre-reuse vs reuse era, split at game #1688 / Feb 1 2026)
- Breakdown by answer type (new word vs reused past answer)

**Run commands:**
- `npm run benchmark` — full run with two-step lookahead (~5-15 min)
- `npm run benchmark:quick` — skip lookahead for fast iteration (~1 min)

**Solver interface:** Direct import of `bestNextGuessHeuristic` and existing pure functions (`feedbackPattern`, `filterCandidatesByFeedback`, `frequencyWeights`, `seasonalBoosts`). No Web Worker — runs synchronously in Node.js.

### 2. Weight Config (`benchmark/configs/`)

JSON files defining all tunable parameters:

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

- `baseline-v1.json` ships as the default (current production weights)
- New configs created for each experiment
- Future: recency curves, word-property models, etc. extend this schema

### 3. Result Files (`benchmark/results/`)

Timestamped JSON files: `2026-03-10T14-30-00_baseline-v1.json`

Each file contains:
- The weight config used
- Summary stats
- Full per-game results array

Result files accumulate over time — each run adds a file, nothing is overwritten. Machine-readable format for future autoresearch loop.

### 4. Dashboard (`benchmark/dashboard.html`)

Standalone HTML file + Chart.js from CDN. No build step, no server — just open in browser.

**Three views:**

1. **Run summary** — Select/drop a result file. Shows average guesses, median, solve rate, guess-count histogram, and the weight config used.

2. **Run comparison** — Load two result files side by side. Shows summary stats delta, histogram overlay, and list of games that changed (e.g., "game #923 SHOAL: 5 guesses → 3 guesses").

3. **Evolution timeline** — Load all result files. Line chart of average guesses over successive experiments. Dots colored by keep/discard status (for future Approach 3). Hover to see config change.

### 5. Not Included (YAGNI)

- No browser integration — benchmark is CLI only
- No database — JSON files are sufficient
- No live-updating dashboard — refresh to see new results
- No Approach 3 automation yet — that's a separate plan

## Approach 3: Autoresearch Loop (future)

The harness is designed so an autoresearch loop is just orchestration on top:

1. Read a config from `benchmark/configs/`
2. Mutate one parameter
3. Run `npm run benchmark:quick`
4. Compare result to previous best
5. Keep or discard, repeat

The `program.md` (in Karpathy's autoresearch pattern) would instruct the agent what parameters to explore, what metric to optimize (average guesses), and how aggressively to search.

All measurement infrastructure will already be in place from Approach 2.

## Weight Model Evolution (future)

Beyond tuning static weights, the harness enables discovering new weighting strategies:

- **Recency curves** — weight past answers based on how long ago they were used (all 5 confirmed reuses are 3.9-4.7 years old)
- **Word-property models** — factor in word commonality, letter patterns, or other features that might predict NYT's reuse selection
- **Adaptive weights** — weights that shift as more reuse data accumulates daily

Each of these would be a new config schema extension, testable through the same benchmark/compare cycle.
