# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test` — run all tests (`tsx --test src/**/*.test.ts`)
- `npm run sync:wordlists` — regenerate `src/lib/wordlists.ts` from source data files
- `npm run fetch:answers` — fetch confirmed answers from NYT API, update `answersByDate.ts`
- `npm run benchmark` — full benchmark: play all historical games (~5-15 min)
- `npm run benchmark:quick` — quick benchmark: skip lookahead (~1-2 min)

## Architecture

Next.js 16 app (App Router, single page) that helps solve daily Wordle puzzles using an entropy-based solver with weighted priors.

### Core solver pipeline

1. **Feedback engine** (`src/lib/wordle/feedback.ts`) — computes Wordle tile patterns (B/Y/G) for a guess+answer pair, handling duplicate-letter rules correctly. `Pattern` is a 5-char string of `B|Y|G`.

2. **Solver** (`src/lib/wordle/solver.ts`) — entropy scoring and candidate filtering. `bestNextGuess` picks the guess maximizing information entropy over the candidate set.

3. **Fast solver** (`src/lib/wordle/solver_fast.ts`) — production solver used by the web worker. Uses a two-phase approach: heuristic letter-frequency shortlisting (top N from ~13K allowed guesses), then full entropy scoring on the shortlist. Adds **two-step lookahead** when candidates <= 200 to optimize for 2-3 guess solves.

4. **Web Worker** (`src/lib/wordle/solverWorker.ts`) — runs `bestNextGuessHeuristic` off the main thread. Communicates via typed messages (`WorkerRequest`/`WorkerResponse`). The main page caches the first guess in localStorage keyed by date.

5. **Worker protocol** (`src/lib/wordle/workerProtocol.ts`) — shared utilities for stale-response detection, first-guess caching logic, and candidate-set fallback (canonical -> broad).

### Candidate weighting

Candidates are weighted by three multiplicative factors:
- **Past-answer weight** (`history.ts`) — NYT reuses past answers at ~11% rate (since Feb 2026); past answers get reduced weight (0.04 for used-once, 0.01 for used-twice) via `pastAnswerWeight(useCount)`
- **Word frequency** (`wordFrequency.ts`) — bigram/unigram scoring as a commonality proxy, maps to [0.2, 1.0]
- **Seasonal boosts** (`seasonalBoost.ts`) — small multiplier for thematically relevant words by month/date

### Wordlists

`src/lib/wordlists.ts` is **auto-generated** by `scripts/sync-wordlists.mjs`. Do not edit it directly.
- `POSSIBLE_WORDS` (~2310) — likely Wordle answers
- `ALLOWED_WORDS` (~13K) — all valid guesses including probe words
- Source data: `src/data/allowed_words.txt`, `src/data/answers_by_date_wordlist.txt`
- To add missing NYT answers, add to `src/data/answer_overrides.txt` then run `npm run sync:wordlists`

### Answer history

`src/lib/wordle/answersByDate.ts` is **auto-generated** by `scripts/fetch-answers.mjs`. Do not edit it directly. Contains the ordered list of all confirmed past Wordle answers (index 0 = 2021-06-19, "cigar"), fetched from the NYT API. `history.ts` uses this to compute past-answer use counts and weights based on a 5:00 AM UTC rollover.

**Data integrity**: The answer list MUST be API-verified. The original Wordle source code contained a pre-determined answer list that diverges from what NYT actually uses (NYT swaps planned words and reuses old ones). To re-verify the full list, clear `src/data/answers_by_date_wordlist.txt` then run `npm run fetch:answers`. The list may contain duplicate entries — this is correct, as NYT reuses past answers (~11% rate since Feb 2026).

A daily GitHub Action (`.github/workflows/update-answers.yml`) runs `fetch:answers` + `sync:wordlists` at 5:30 AM UTC and auto-commits new answers. The fetch script is idempotent — it reuses existing entries and only fetches dates not yet in the local list.

### UI

Single-page client component (`src/app/page.tsx`). Tailwind CSS v4 for styling. Features: tile-tap feedback entry, undo/reset, guess history with colored tiles, visual keyboard, top-N guess explorer, confidence indicator.

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

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json).
