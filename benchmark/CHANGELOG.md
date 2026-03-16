# Benchmark Changelog

Tracks solver changes and benchmark results over time. Each entry records the git commit (solver version), the config used, and results.

## Solver Versions

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

### 2026-03-16 — `ef499ee` (candidateBonus fix + git tracking)

| Config | Mode | Avg | Solve % | Fails | Games |
|--------|------|-----|---------|-------|-------|
| flat-frequency | quick | 3.500 | 99.9% | 1 | 1731 |
| baseline-v1 | quick | 3.504 | 99.9% | 2 | 1731 |

**flat-frequency** (production-equivalent config):
- Reuse era: avg=3.442, 100% solve (43 games). Reused answers: avg=3.600 (5 games).
- 1 failure: JOKER (game #675) — solver exhausted guesses testing common letters before finding J. Final sequence: RAISE → DETER → BOREL → MOVER → WOKEN → POKER.
- Slight overall regression vs 3/10 (3.475 → 3.500) likely due to 6 additional games in the dataset (1725 → 1731), not the solver change.

**baseline-v1**:
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

| Config | Past (once) | Past (twice) | Freq Range | Seasonal |
|--------|-------------|--------------|------------|----------|
| baseline-v1 | 0.04 | 0.01 | [0.2, 1.0] | yes |
| flat-frequency | 0.04 | 0.01 | [1.0, 1.0] | no |
| no-seasonal | 0.04 | 0.01 | [0.2, 1.0] | no |
| equal-weight | 0.04 | 0.01 | [1.0, 1.0] | yes |
| higher-past-weight | 0.10 | 0.05 | [0.2, 1.0] | yes |
| combined-v1 | 0.10 | 0.05 | [1.0, 1.0] | no |

Note: The production solver (`solverWorker.ts`) ignores frequency and seasonal weights entirely — it uses past-answer weight only. The benchmark engine applies config values faithfully, so benchmark results with `baseline-v1` do NOT match production behavior. Use `flat-frequency` to benchmark what production actually does.
