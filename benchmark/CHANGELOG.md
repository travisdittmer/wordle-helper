# Benchmark Changelog

Tracks solver changes and benchmark results over time. Each entry records the git commit (solver version), the config used, and results.

## Solver Versions

### `9783e6a` — 2026-03-26
**feat: expand ALLOWED_WORDS from 12,953 to 14,855 via NYT bundle extraction**

Added `scripts/fetch-allowed-words.mjs` which extracts the complete valid-guess list directly from NYT's Wordle JS bundle. The previous list (sourced from 3Blue1Brown) was missing 1,902 words that NYT accepts (e.g., TARSE). Also fixed the Explore tab's `topGuesses()` to use heuristic shortlisting instead of naive `.slice(0, 2000)`.

Added `production.json` benchmark config that exactly matches `DEFAULT_WEIGHT_CONFIG` in `weights.ts` (past-answer only, no frequency, no seasonal). Previous "production-equivalent" config (`flat-frequency`) incorrectly had `seasonalBoostEnabled: true`.

Added `true-uniform.json` for pure uniform entropy comparison.

### `7406b92` — 2026-03-24
**fix: candidate bonus formula favored low-probability candidates over high-probability ones**

The `candidateBonus` in `solver_fast.ts` (finishThreshold path) used `p * log2(1/p)` (self-information), which peaks at p ≈ 0.37 and decreases toward both 0 and 1. With asymmetric weights — e.g., BROOD (weight 1.0) vs FROND (weight 0.04, past answer) — the formula gave a larger bonus to the low-weight candidate (0.181) than the high-weight one (0.054), causing the solver to pick FROND over BROOD despite BROOD having a 96% solve chance.

Fixed to use `p` directly (solve probability). This correctly prefers the candidate most likely to be the answer. For equal-weight candidates the two formulas are equivalent (`p * log2(1/p)` at p=0.5 equals 0.5 = p), so only asymmetric-weight scenarios are affected.

Discovered via today's Wordle (BROOD, 2026-03-24): RAISE → COURD → FROND → BROOD. The solver should have recommended BROOD at guess 3.

### `885531a` / `ef499ee` — 2026-03-16
**fix: candidate bonus went negative when all candidates had low weights**

The `candidateBonus` formula in `solver_fast.ts` (finishThreshold path) used `(1/W) * log2(W)` where W is the total candidate weight. When all remaining candidates were past answers (weight 0.04 each), W < 1 and `log2(W)` went negative, turning the bonus into a massive penalty (~-45 bits). This caused the solver to prefer probe words over actual candidates in small-candidate scenarios (e.g., 2 candidates left), wasting a guess.

Fixed to per-candidate bonus `(w_i/W) * log2(W/w_i)` which depends only on relative weights and is always non-negative.

`ef499ee` also added git commit tracking to benchmark results (hash in JSON, filename, and console output).

### `82404a3` — 2026-03-10
**perf: remove frequency and seasonal weight priors**

Benchmark results showed that frequency weighting and seasonal boosts hurt performance. Production solver updated to use past-answer weight only. This was the single biggest improvement found during initial benchmarking.

### `74ee83b` — 2026-03-10
**feat: past-answer reuse support + benchmark configs and plans**

Added count-based `pastAnswerWeight()` (unused=1.0, used-once=0.04, used-twice=0.01). Previously past answers were excluded entirely (weight=0). Also added `detectFeedbackContradiction()` for tile entry validation. Created benchmark weight configs for systematic testing.

### `b24581f` — 2026-03-10
**feat: benchmark CLI + engine + stats + dashboard**

Initial benchmark harness. Plays all historical Wordle games with configurable weight parameters. Quick mode (no lookahead) and full mode (two-step lookahead). Dashboard at `benchmark/dashboard.html`.

---

## Benchmark Runs

### 2026-03-26 — `9783e6a` (14,855 allowed words + production config)

| Config | Mode | Avg | Solve % | Fails | Time | Games |
|--------|------|-----|---------|-------|------|-------|
| production | quick | 3.329 | 100.0% | 0 | ~21 min | 1741 |
| true-uniform | quick | 3.505 | 99.9% | 1 | ~21 min | 1741 |
| baseline-v1 | quick | 3.311 | 100.0% | 0 | ~21 min | 1741 |

**production quick** (exact match of `DEFAULT_WEIGHT_CONFIG`):
- First guess: TARSE (59%, games 0–~1001) then RAISE (41%, games ~1002–1740). Transition occurs as past-answer downweighting accumulates.
- 0 failures, 100% solve rate.
- 3-or-fewer rate: 64.1%.

**true-uniform quick** (all candidates weight 1.0):
- First guess: TARSE (100%).
- 1 failure: POKER (tarse → rider → lower → hoven → forex → joker).
- 3-or-fewer rate: 51.5%.
- Production weights save 0.176 guesses/game vs uniform, confirming past-answer priors improve performance.

**Note**: Quick mode now takes ~21 min (was ~2 min) due to expanded ALLOWED_WORDS (14,855 vs 12,953). The heuristic shortlist (500 words) evaluates proportionally more candidates.

### 2026-03-16 — `0b926e0` (candidateBonus fix + git tracking)

| Config | Mode | Avg | Solve % | Fails | Time | Games |
|--------|------|-----|---------|-------|------|-------|
| flat-frequency | quick | 3.500 | 99.9% | 1 | 20.7 min | 1731 |
| flat-frequency | full | 3.504 | 100.0% | 0 | 174.1 min | 1731 |
| baseline-v1 | quick | 3.504 | 99.9% | 2 | 20.8 min | 1731 |

**flat-frequency quick** (production-equivalent config, no lookahead):
- Reuse era: avg=3.442, 100% solve (43 games). Reused answers: avg=3.600 (5 games).
- 1 failure: JOKER (game #675) — solver exhausted guesses testing common letters before finding J. Final sequence: RAISE → DETER → BOREL → MOVER → WOKEN → POKER.
- Slight overall regression vs 3/10 (3.475 → 3.500) likely due to 6 additional games in the dataset (1725 → 1731), not the solver change.

**flat-frequency full** (with two-step lookahead):
- Reuse era: avg=3.419, 100% solve (43 games). Reused answers: avg=3.600 (5 games).
- 100% solve rate — lookahead saved JOKER by narrowing to _OKER one guess earlier.
- Average is slightly worse than quick (3.504 vs 3.500): lookahead shifts some 3-guess solves into 4-guess solves (794 vs 820 threes, 716 vs 678 fours) but converts tail-end failures into solves.
- Runtime is ~8.4x slower than quick mode (174 min vs 21 min). The lookahead's cost is high relative to its benefit — it eliminates 1 failure out of 1731 games while making the average marginally worse.

**baseline-v1 quick**:
- Reuse era: avg=3.605, 100% solve (43 games). Reused answers: avg=3.600 (5 games).
- Note: this config includes frequency + seasonal weights, which the benchmark engine applies even though the production solver no longer uses them.

### 2026-03-10 — `82404a3` (frequency/seasonal removed)

| Config | Mode | Avg | Solve % | Fails | Games |
|--------|------|-----|---------|-------|-------|
| flat-frequency | quick | 3.475 | 100.0% | 0 | ~1725 |
| combined-v1 | quick | 3.485 | 99.9% | 1 | ~1725 |
| higher-past-weight | quick | 3.489 | 99.9% | 2 | ~1725 |
| baseline-v1 | quick | 3.502 | 99.9% | 2 | ~1725 |
| no-seasonal | quick | 3.502 | 99.9% | 2 | ~1725 |
| equal-weight | quick | 3.509 | 99.9% | 2 | ~1725 |

Key finding: removing frequency weighting (`flat-frequency`) was the single biggest improvement and eliminated all failures.

---

## Configs

Configs live in `benchmark/configs/*.json`. They control candidate weighting parameters — a separate variable from solver logic.

| Config | Past (once) | Past (twice) | Freq Range | Seasonal | Notes |
|--------|-------------|--------------|------------|----------|-------|
| **production** | 0.04 | 0.01 | [1.0, 1.0] | no | **Matches DEFAULT_WEIGHT_CONFIG** |
| **true-uniform** | 1.0 | 1.0 | [1.0, 1.0] | no | All candidates equally weighted |
| baseline-v1 | 0.04 | 0.01 | [0.2, 1.0] | yes | All factors enabled |
| flat-frequency | 0.04 | 0.01 | [1.0, 1.0] | yes | No freq, but seasonal still on |
| no-seasonal | 0.04 | 0.01 | [0.2, 1.0] | no | |
| equal-weight | 1.0 | 1.0 | [0.2, 1.0] | yes | No past penalty, freq+seasonal on |
| higher-past-weight | 0.10 | 0.03 | [0.2, 1.0] | yes | |
| combined-v1 | 0.10 | 0.03 | [1.0, 1.0] | no | |

Note: Use `production` config to benchmark what the web app actually does. Previous advice to use `flat-frequency` was incorrect (it has `seasonalBoostEnabled: true`).
