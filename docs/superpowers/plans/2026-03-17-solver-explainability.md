# Solver Explainability: Analysis Drawer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a side drawer that explains why the solver recommends a particular guess, showing pattern outcomes and letter coverage.

**Architecture:** On-demand analysis module (`analysis.ts`) with two pure functions. Drawer component (`AnalysisDrawer.tsx`) calls them when opened. No changes to the solver worker or recommendation pipeline.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind CSS v4, `node:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-03-17-solver-explainability-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/wordle/analysis.ts` | Create | `analyzeGuess()` and `letterCoverage()` pure functions |
| `src/lib/wordle/analysis.test.ts` | Create | Unit tests for analysis module |
| `src/components/AnalysisDrawer.tsx` | Create | Side drawer / bottom sheet with pattern outcomes + letter coverage |
| `src/components/AnswerZone.tsx` | Modify | Add "Why?" trigger link, accept `onWhyClick` callback |
| `src/app/page.tsx` | Modify | Add `analysisOpen` state, `activeWeights` memo, render drawer, auto-close |

---

## Chunk 1: Analysis Module

### Task 1: `analyzeGuess` — tests and implementation

**Files:**
- Create: `src/lib/wordle/analysis.ts`
- Create: `src/lib/wordle/analysis.test.ts`

- [ ] **Step 1: Write failing tests for `analyzeGuess`**

```typescript
// src/lib/wordle/analysis.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeGuess } from './analysis';

test('analyzeGuess: 2 candidates with equal weights', () => {
  const result = analyzeGuess('grade', ['grade', 'trade'], [1.0, 1.0]);

  // Should produce 2 partitions: GGGGG (grade) and BGGGG (trade)
  assert.equal(result.partitions.length, 2);
  assert.equal(result.solveChance, 0.5);
  assert.equal(result.expectedRemaining, 1); // 1 candidate in the non-solve bucket
  assert.equal(result.worstCase, 1);

  // Partitions sorted by totalWeight descending — both equal so check both exist
  const patterns = result.partitions.map(p => p.pattern);
  assert.ok(patterns.includes('GGGGG'));
  assert.ok(patterns.includes('BGGGG'));

  // GGGGG bucket contains only 'grade'
  const solveBucket = result.partitions.find(p => p.pattern === 'GGGGG')!;
  assert.deepEqual(solveBucket.candidates, ['grade']);
  assert.equal(solveBucket.totalWeight, 1.0);
});

test('analyzeGuess: probe word (not a candidate)', () => {
  const result = analyzeGuess('grate', ['grade', 'trade'], [1.0, 1.0]);

  // GRATE is not a candidate, so no GGGGG bucket
  assert.equal(result.solveChance, 0);
  assert.equal(result.partitions.length, 2);

  // Each bucket has 1 candidate
  assert.equal(result.expectedRemaining, 1);
  assert.equal(result.worstCase, 1);
});

test('analyzeGuess: weighted candidates', () => {
  // grade has low weight (past answer), trade has normal weight
  const result = analyzeGuess('grade', ['grade', 'trade'], [0.04, 1.0]);

  // solveChance = 0.04 / 1.04
  assert.ok(Math.abs(result.solveChance - 0.04 / 1.04) < 0.001);

  // Partitions sorted by weight: BGGGG (trade, 1.0) first, GGGGG (grade, 0.04) second
  assert.equal(result.partitions[0].pattern, 'BGGGG');
  assert.equal(result.partitions[1].pattern, 'GGGGG');
});

test('analyzeGuess: many candidates produces correct partition count', () => {
  // Use a small known set
  const candidates = ['grade', 'trade', 'crane', 'crate', 'trace'];
  const weights = [1, 1, 1, 1, 1];
  const result = analyzeGuess('raise', candidates, weights);

  // Each candidate should produce a feedback pattern; some may collide into same bucket
  assert.ok(result.partitions.length >= 1);
  assert.ok(result.partitions.length <= 5);

  // Total candidates across all partitions should equal input
  const totalCandidates = result.partitions.reduce((sum, p) => sum + p.candidates.length, 0);
  assert.equal(totalCandidates, 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/wordle/analysis.test.ts`
Expected: FAIL — `analyzeGuess` not found

- [ ] **Step 3: Implement `analyzeGuess`**

```typescript
// src/lib/wordle/analysis.ts
import { feedbackPattern, type Pattern } from './feedback';

export interface Partition {
  pattern: Pattern;
  candidates: string[];
  totalWeight: number;
}

export interface GuessAnalysis {
  partitions: Partition[];
  solveChance: number;
  expectedRemaining: number;
  worstCase: number;
}

export function analyzeGuess(
  guess: string,
  candidates: readonly string[],
  weights: readonly number[],
): GuessAnalysis {
  const buckets = new Map<Pattern, { candidates: string[]; totalWeight: number }>();
  let totalWeight = 0;

  for (let i = 0; i < candidates.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    totalWeight += w;
    const p = feedbackPattern(guess, candidates[i]);
    const bucket = buckets.get(p);
    if (bucket) {
      bucket.candidates.push(candidates[i]);
      bucket.totalWeight += w;
    } else {
      buckets.set(p, { candidates: [candidates[i]], totalWeight: w });
    }
  }

  const partitions: Partition[] = Array.from(buckets.entries())
    .map(([pattern, bucket]) => ({ pattern, ...bucket }))
    .sort((a, b) => b.totalWeight - a.totalWeight);

  const solveBucket = buckets.get('GGGGG' as Pattern);
  const solveChance = totalWeight > 0 && solveBucket ? solveBucket.totalWeight / totalWeight : 0;

  let expectedRemaining = 0;
  let worstCase = 0;
  for (const p of partitions) {
    if (p.pattern === 'GGGGG') continue;
    const prob = totalWeight > 0 ? p.totalWeight / totalWeight : 0;
    expectedRemaining += prob * p.candidates.length;
    worstCase = Math.max(worstCase, p.candidates.length);
  }

  return { partitions, solveChance, expectedRemaining, worstCase };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/wordle/analysis.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/wordle/analysis.ts src/lib/wordle/analysis.test.ts
git commit -m "feat: add analyzeGuess function for solver explainability"
```

---

### Task 2: `letterCoverage` — tests and implementation

**Files:**
- Modify: `src/lib/wordle/analysis.ts`
- Modify: `src/lib/wordle/analysis.test.ts`

- [ ] **Step 1: Write failing tests for `letterCoverage`**

Append to `src/lib/wordle/analysis.test.ts`:

```typescript
import { letterCoverage } from './analysis';

test('letterCoverage: first guess has all new letters', () => {
  const result = letterCoverage('raise', []);

  assert.deepEqual(result.newLetters, ['r', 'a', 'i', 's', 'e']);
  assert.equal(result.retested.size, 0);
  assert.deepEqual(result.positionsProbed, [true, true, true, true, true]);
});

test('letterCoverage: second guess identifies retested and new letters', () => {
  const history = [{ guess: 'raise', pattern: 'YYBBG' as Pattern }];
  const result = letterCoverage('drape', history);

  // d, p are new; r, a, e are retested
  assert.deepEqual(result.newLetters, ['d', 'p']);
  assert.ok(result.retested.has('r'));
  assert.ok(result.retested.has('a'));
  assert.ok(result.retested.has('e'));
  // r was yellow (present), a was yellow (present), e was green (correct)
  assert.equal(result.retested.get('r'), 'present');
  assert.equal(result.retested.get('a'), 'present');
  assert.equal(result.retested.get('e'), 'correct');
});

test('letterCoverage: positions with known greens are not new probes', () => {
  // After RAISE with pattern YYBBG, position 4 is a confirmed green (E)
  const history = [{ guess: 'raise', pattern: 'YYBBG' as Pattern }];
  const result = letterCoverage('drape', history);

  // Position 4 (E) is a known green, not a new probe
  assert.equal(result.positionsProbed[4], false);
  // Position 0 (D) is a new letter — new probe
  assert.equal(result.positionsProbed[0], true);
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx tsx --test src/lib/wordle/analysis.test.ts`
Expected: New letterCoverage tests FAIL, analyzeGuess tests still PASS

- [ ] **Step 3: Implement `letterCoverage`**

Add to `src/lib/wordle/analysis.ts`:

```typescript
export type LetterStatus = 'correct' | 'present' | 'absent';

export interface LetterCoverageResult {
  newLetters: string[];
  retested: Map<string, LetterStatus>;
  positionsProbed: boolean[];
}

export function letterCoverage(
  guess: string,
  history: readonly { guess: string; pattern: Pattern }[],
): LetterCoverageResult {
  // Build known letter states from history
  const knownLetters = new Map<string, LetterStatus>();
  const knownGreens = new Set<number>(); // positions with confirmed greens

  for (const { guess: g, pattern } of history) {
    for (let i = 0; i < 5; i++) {
      const letter = g[i];
      const tile = pattern[i];
      if (tile === 'G') {
        knownLetters.set(letter, 'correct');
        knownGreens.add(i);
      } else if (tile === 'Y' && knownLetters.get(letter) !== 'correct') {
        knownLetters.set(letter, 'present');
      } else if (tile === 'B' && !knownLetters.has(letter)) {
        knownLetters.set(letter, 'absent');
      }
    }
  }

  const newLetters: string[] = [];
  const retested = new Map<string, LetterStatus>();
  const positionsProbed: boolean[] = [];

  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    const known = knownLetters.get(letter);
    if (known) {
      retested.set(letter, known);
      // A position is not a new probe if it's confirming a known green at that position
      positionsProbed.push(!knownGreens.has(i));
    } else {
      newLetters.push(letter);
      positionsProbed.push(true);
    }
  }

  return { newLetters, retested, positionsProbed };
}
```

- [ ] **Step 4: Run all tests**

Run: `npx tsx --test src/lib/wordle/analysis.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/wordle/analysis.ts src/lib/wordle/analysis.test.ts
git commit -m "feat: add letterCoverage function for solver explainability"
```

---

## Chunk 2: Drawer Component

### Task 3: AnalysisDrawer shell — open/close behavior

**Files:**
- Create: `src/components/AnalysisDrawer.tsx`

- [ ] **Step 1: Create the drawer component with open/close behavior**

```tsx
// src/components/AnalysisDrawer.tsx
'use client';

import { useEffect, useCallback, useMemo } from 'react';
import type { Pattern } from '@/lib/wordle/feedback';
import { analyzeGuess, letterCoverage, type GuessAnalysis, type LetterCoverageResult } from '@/lib/wordle/analysis';

interface AnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  guess: string;
  candidates: string[];
  weights: number[];
  history: Array<{ guess: string; pattern: Pattern }>;
}

export function AnalysisDrawer({ open, onClose, guess, candidates, weights, history }: AnalysisDrawerProps) {
  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const analysis = useMemo(() => {
    if (!open || !guess || candidates.length === 0) return null;
    return analyzeGuess(guess, candidates, weights);
  }, [open, guess, candidates, weights]);

  const coverage = useMemo(() => {
    if (!open || !guess) return null;
    return letterCoverage(guess, history);
  }, [open, guess, history]);

  if (!open || !analysis || !coverage) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer: right panel on desktop, bottom sheet on mobile */}
      <div className="fixed z-50 overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100
        inset-x-0 bottom-0 top-[30vh] rounded-t-2xl border-t
        md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-80 md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-950 px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Why {guess.toUpperCase()}?</h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close analysis"
          >
            &times;
          </button>
        </div>

        <div className="px-4 py-4 space-y-6">
          {/* Pattern Outcomes — Task 4 */}
          <PatternOutcomes analysis={analysis} guess={guess} />

          {/* Letter Coverage — Task 5 */}
          <LetterCoverageSection coverage={coverage} guess={guess} />
        </div>
      </div>
    </>
  );
}

// Placeholder — implemented in Task 4
function PatternOutcomes({ analysis, guess }: { analysis: GuessAnalysis; guess: string }) {
  return <div className="text-xs text-zinc-500">Pattern outcomes: {analysis.partitions.length} patterns</div>;
}

// Placeholder — implemented in Task 5
function LetterCoverageSection({ coverage, guess }: { coverage: LetterCoverageResult; guess: string }) {
  return <div className="text-xs text-zinc-500">Letter coverage: {coverage.newLetters.length} new</div>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisDrawer.tsx
git commit -m "feat: add AnalysisDrawer shell with open/close behavior"
```

---

### Task 4: Pattern Outcomes section

**Files:**
- Modify: `src/components/AnalysisDrawer.tsx`

- [ ] **Step 1: Replace the `PatternOutcomes` placeholder**

In `AnalysisDrawer.tsx`, add `useState` to the existing React import:
```tsx
import { useEffect, useCallback, useMemo, useState } from 'react';
```

Then replace the placeholder `PatternOutcomes` function with:

```tsx
function TileSquare({ tile }: { tile: string }) {
  const bg = tile === 'G' ? 'bg-green-600' : tile === 'Y' ? 'bg-yellow-500' : 'bg-zinc-700';
  return <span className={`inline-block h-4 w-4 rounded-sm ${bg}`} />;
}

function PatternOutcomes({ analysis, guess }: { analysis: GuessAnalysis; guess: string }) {
  const [expanded, setExpanded] = useState(false);
  const threshold = 10;
  const showAll = analysis.partitions.length <= threshold || expanded;
  const visible = showAll ? analysis.partitions : analysis.partitions.slice(0, 5);
  const hiddenCount = analysis.partitions.length - visible.length;

  const totalWeight = analysis.partitions.reduce((sum, p) => sum + p.totalWeight, 0);

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
        If you guess {guess.toUpperCase()}...
      </h3>
      <div className="space-y-1.5">
        {visible.map((p) => {
          const pct = totalWeight > 0 ? (p.totalWeight / totalWeight) * 100 : 0;
          const isSolve = p.pattern === 'GGGGG';
          let outcomeText: string;
          if (isSolve) {
            outcomeText = 'solved!';
          } else if (p.candidates.length <= 3) {
            outcomeText = p.candidates.map(c => c.toUpperCase()).join(', ');
          } else {
            outcomeText = `${p.candidates.length} remaining`;
          }
          return (
            <div key={p.pattern} className="flex items-center gap-2 text-xs">
              <div className="flex gap-0.5">
                {p.pattern.split('').map((tile, i) => (
                  <TileSquare key={i} tile={tile} />
                ))}
              </div>
              <span className={`flex-1 ${isSolve ? 'text-green-400 font-medium' : 'text-zinc-300'}`}>
                {outcomeText}
              </span>
              <span className="text-zinc-500 tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
        >
          {hiddenCount} more pattern{hiddenCount === 1 ? '' : 's'}...
        </button>
      )}
    </section>
  );
}
```

Note: The `GuessAnalysis` type is already imported in Task 3. The placeholder already uses it.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisDrawer.tsx
git commit -m "feat: add pattern outcomes section to analysis drawer"
```

---

### Task 5: Letter Coverage section

**Files:**
- Modify: `src/components/AnalysisDrawer.tsx`

- [ ] **Step 1: Replace the `LetterCoverageSection` placeholder**

Replace the placeholder `LetterCoverageSection` function in `AnalysisDrawer.tsx` with:

```tsx
function LetterCoverageSection({ coverage, guess }: { coverage: LetterCoverageResult; guess: string }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
        Letter coverage
      </h3>
      <div className="flex gap-1.5">
        {guess.split('').map((letter, i) => {
          const status = coverage.retested.get(letter);
          const isNew = !status;
          let bg: string;
          let textColor: string;
          if (isNew) {
            bg = 'bg-blue-600/20 border-blue-500/50';
            textColor = 'text-blue-300';
          } else if (status === 'correct') {
            bg = 'bg-green-600/20 border-green-500/50';
            textColor = 'text-green-300';
          } else if (status === 'present') {
            bg = 'bg-yellow-600/20 border-yellow-500/50';
            textColor = 'text-yellow-300';
          } else {
            bg = 'bg-zinc-800/50 border-zinc-700';
            textColor = 'text-zinc-500 line-through';
          }
          return (
            <div
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-sm font-bold ${bg} ${textColor}`}
            >
              {letter.toUpperCase()}
            </div>
          );
        })}
      </div>
      {coverage.newLetters.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          Tests {coverage.newLetters.length} new letter{coverage.newLetters.length === 1 ? '' : 's'}:{' '}
          {coverage.newLetters.map(l => l.toUpperCase()).join(', ')}
        </p>
      )}
      {coverage.newLetters.length === 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          All letters previously tested
        </p>
      )}
    </section>
  );
}
```

Note: The `LetterCoverageResult` type is already imported in Task 3. The placeholder already uses it.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisDrawer.tsx
git commit -m "feat: add letter coverage section to analysis drawer"
```

---

## Chunk 3: Integration

### Task 6: Wire up AnswerZone trigger and page.tsx state

**Files:**
- Modify: `src/components/AnswerZone.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `onWhyClick` callback to AnswerZone**

In `src/components/AnswerZone.tsx`:

Add `onWhyClick?: () => void` to the `AnswerZoneProps` interface.

Add it to the destructured props in the function signature.

In the `shortlist` state (line 89-99), after the recommendation bar, add:

```tsx
{recommended && onWhyClick && (
  <button
    onClick={onWhyClick}
    className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
  >
    {candidateCount <= 3 && candidates.length >= 2
      ? `Why not ${candidates.find(c => c !== recommended.guess)?.toUpperCase()}?`
      : 'Why this guess?'}
  </button>
)}
```

In the `suggest` state (line 117-128), after the probe indicator, add:

```tsx
{recommended && onWhyClick && !isComputing && (
  <button
    onClick={onWhyClick}
    className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
  >
    Why this guess?
  </button>
)}
```

- [ ] **Step 2: Add `activeWeights` memo and drawer state to page.tsx**

In `src/app/page.tsx`:

Add import:
```typescript
import { AnalysisDrawer } from '@/components/AnalysisDrawer';
```

Add state after the existing state declarations (around line 113):
```typescript
const [analysisOpen, setAnalysisOpen] = useState(false);
```

Add `activeWeights` memo after the existing `activeCandidates` memo (around line 242):
```typescript
const activeWeights = useMemo(() => {
  return weights.filter((w) => w > 0);
}, [weights]);
```

Auto-close the drawer in `onApplyFeedback` (after line 292 `computeRecommended(next)`):
```typescript
setAnalysisOpen(false);
```

Auto-close in `onUndo` (after line 307 `computeRecommended(prev.candidates)`):
```typescript
setAnalysisOpen(false);
```

Auto-close in `onReset` (after line 318 `computeRecommended(next)`):
```typescript
setAnalysisOpen(false);
```

- [ ] **Step 3: Pass `onWhyClick` to AnswerZone and render the drawer**

In `src/app/page.tsx`:

Add `onWhyClick={() => setAnalysisOpen(true)}` to the `<AnswerZone>` component (around line 341-349).

After the closing `</main>` tag (before the closing `</div>`), add:

```tsx
{recommended && (
  <AnalysisDrawer
    open={analysisOpen}
    onClose={() => setAnalysisOpen(false)}
    guess={recommended.guess}
    candidates={activeCandidates}
    weights={activeWeights}
    history={history}
  />
)}
```

- [ ] **Step 4: Verify everything compiles and tests pass**

Run: `npm run lint && npm run test && npm run build`
Expected: All pass, no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/AnswerZone.tsx src/app/page.tsx
git commit -m "feat: wire up analysis drawer with Why? trigger in AnswerZone"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start dev server and test the drawer**

Run: `npm run dev`

Test scenario:
1. Open http://localhost:3000
2. Wait for solver recommendation (e.g., RAISE)
3. Click "Why this guess?" — drawer should slide in from right (desktop) or up (mobile)
4. Verify pattern outcomes section shows tile patterns with probabilities
5. Verify letter coverage shows all 5 letters highlighted as new (first guess)
6. Click backdrop or X to close
7. Enter RAISE with some feedback pattern (e.g., YYBBG for answer GRADE)
8. Verify drawer auto-closed after applying feedback
9. Click "Why?" on the new recommendation
10. Verify letter coverage now distinguishes new vs. retested letters
11. Verify pattern outcomes shows adaptive display (all if ≤10, collapsed if >10)

- [ ] **Step 2: Test mobile layout**

Open browser dev tools, switch to mobile viewport. Verify drawer appears as bottom sheet.

- [ ] **Step 3: Fix any issues found, commit**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```
(Skip if no issues found.)
