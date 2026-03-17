# Solver Explainability: Analysis Drawer

## Overview

Add a side drawer to the Wordle Helper that explains *why* the solver recommends a particular guess. The drawer shows pattern outcomes (what happens for each possible feedback) and letter coverage (which new letters the guess tests). The goal is to help Wordle enthusiasts understand and learn from the solver's reasoning, not just follow its suggestions.

## Target Audience

Wordle enthusiasts who want to improve their strategy. We can use real terminology (entropy, probes, partitions) and go deeper without simplifying for casual players.

## Key Decisions

- **Layout:** Side drawer (desktop: 320px overlay from right; mobile: bottom sheet at ~70vh).
- **Primary moment:** Before guessing — "why should I trust this recommendation?"
- **Architecture:** Approach 3 — separate on-demand analysis module. No changes to the recommendation worker or solver pipeline. The drawer computes its own data from props when opened.
- **v1 scope:** Pattern outcomes + letter coverage. Other features (top guesses, expected remaining, candidate weights, post-guess analysis) are deferred to v2.

## Architecture

### Analysis Module

New file: `src/lib/wordle/analysis.ts`

Two pure functions, no worker needed:

#### `analyzeGuess(guess, candidates, weights)`

For a single guess, computes partition data by calling `feedbackPattern(guess, candidate)` for each candidate.

Returns:
- `partitions`: array of `{ pattern: Pattern, candidates: string[], totalWeight: number }` sorted by totalWeight descending
- `solveChance`: probability the guess is the answer (weight of GGGGG bucket / total weight)
- `expectedRemaining`: weighted average of non-GGGGG bucket sizes
- `worstCase`: size of the largest non-GGGGG bucket

Performance: calls `feedbackPattern()` once per candidate. At the point where the drawer is most useful (candidates <= 200), this is trivially fast. Even for the opening guess (~2300 candidates), it's a single pass with no entropy scoring — well under 10ms.

#### `letterCoverage(guess, history)`

Given the guess and prior feedback history, computes letter status via set operations.

Returns:
- `newLetters`: letters in the guess not yet tested in any prior guess
- `retested`: letters already seen, with their known state (green/yellow/black)
- `positionsProbed`: per-position breakdown — is this position testing new info or confirming a known green?

### Drawer Component

New file: `src/components/AnalysisDrawer.tsx`

Props:
```typescript
{
  open: boolean;
  onClose: () => void;
  guess: string;
  candidates: string[];  // filtered active candidates (weight > 0), same as activeCandidates in page.tsx
  weights: number[];     // parallel array, same filtering applied
  history: Array<{ guess: string; pattern: Pattern }>;
}
```

The component calls `analyzeGuess()` and `letterCoverage()` internally when it mounts/opens. No data passed from the solver. The `candidates` and `weights` arrays should be pre-filtered to exclude zero-weight entries (matching `activeCandidates` used elsewhere in the UI).

#### Behavior

- Desktop: slides in from the right, ~320px wide, overlays with semi-transparent backdrop. Main column stays centered.
- Mobile: slides up from the bottom as a full-width sheet, ~70vh tall, scrollable.
- Close via: X button, backdrop click, or Escape key.

#### Section 1: Pattern Outcomes

- Header: "If you guess [WORD]..."
- List of pattern-to-outcome rows, each showing:
  - 5-tile pattern rendered as colored squares (B/Y/G)
  - Outcome text: "solved!" for GGGGG, candidate name(s) for buckets with ≤3 candidates, "N remaining" for larger buckets
  - Probability as percentage (derived from weights)
- Adaptive display:
  - 10 or fewer patterns: show all rows
  - More than 10: show top 5 by probability + collapsed "N more patterns" expander

#### Section 2: Letter Coverage

- Compact 5-cell grid showing the guess letters, each colored by status:
  - New/untested: highlighted (blue)
  - Already confirmed correct position (green in history): green
  - Already confirmed present (yellow in history): amber
  - Already ruled out (black in history): dimmed/strikethrough
- One-line summary: "Tests N new letters: X, Y, Z"

### Integration

#### AnswerZone changes

- Add a "Why?" link below the recommended guess
- Only visible when there's a recommendation and not in computing/solved state
- Adapts text: "Why this guess?" generally, "Why not [other]?" in the 2-3 candidate case

#### page.tsx changes

- New state: `analysisOpen` (boolean)
- Auto-close drawer when: new feedback applied, undo, or reset (i.e., when candidates change)
- Render `<AnalysisDrawer>` at the top level, passing current candidates, weights, recommended guess, and history
- No changes to the worker, solver, or computation flow

#### No changes to

- `solverWorker.ts` — recommendation path untouched
- `solver_fast.ts` — no new exports needed
- `weights.ts` — drawer uses the same weights already computed in page.tsx

## v2 Features (deferred)

These are accommodated by the design without refactoring:

**Top guesses ranked:** Third drawer section showing top 5 by score. Uses existing `topGuesses()` from `solver.ts`. Expensive with many candidates — limit to candidates <= 50 or run with reduced search space.

**Expected guesses remaining:** One-liner above pattern outcomes: "Expected: 1.5 more guesses." Data already computed by `analyzeGuess()` (`expectedRemaining` field), just not displayed in v1.

**Candidate weights:** In pattern outcomes, when a bucket expands to show candidate names, show their weights: "GRADE (0.04x — past answer)". Data already in the weights array.

**Post-guess analysis:** After applying feedback, show what actually happened: "Your guess split N words into M. Optimal was K." Separate trigger in GuessHistory, reuses the same drawer and analysis module.

## Files to Create

- `src/lib/wordle/analysis.ts` — analysis functions
- `src/components/AnalysisDrawer.tsx` — drawer component

## Files to Modify

- `src/components/AnswerZone.tsx` — add "Why?" trigger link
- `src/app/page.tsx` — add drawer state, render AnalysisDrawer, auto-close logic
