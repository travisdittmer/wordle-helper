'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import type { Pattern } from '@/lib/wordle/feedback';
import { analyzeGuess, letterCoverage, type GuessAnalysis, type LetterCoverageResult } from '@/lib/wordle/analysis';
import { scoreGuessWeightedEntropy } from '@/lib/wordle/solver';

interface AnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  guess: string;
  candidates: string[];
  weights: number[];
  history: Array<{ guess: string; pattern: Pattern }>;
  /** The solver's recommended guess, shown for comparison when analyzing a custom guess. */
  recommendedGuess?: string;
}

function TileSquare({ tile }: { tile: string }) {
  const bg = tile === 'G' ? 'bg-green-600' : tile === 'Y' ? 'bg-yellow-500' : 'bg-zinc-300 dark:bg-zinc-700';
  return <span className={`inline-block h-4 w-4 rounded-sm ${bg}`} />;
}

function PatternOutcomes({ analysis, guess }: { analysis: GuessAnalysis; guess: string }) {
  const [expanded, setExpanded] = useState(false);

  // Sort by candidates remaining (descending), solved last
  const sorted = useMemo(() => {
    return [...analysis.partitions].sort((a, b) => {
      if (a.pattern === 'GGGGG') return 1;
      if (b.pattern === 'GGGGG') return -1;
      return b.candidates.length - a.candidates.length;
    });
  }, [analysis.partitions]);

  const threshold = 25;
  const showAll = sorted.length <= threshold || expanded;
  const visible = showAll ? sorted : sorted.slice(0, 15);
  const hiddenCount = sorted.length - visible.length;
  const totalWeight = sorted.reduce((sum, p) => sum + p.totalWeight, 0);

  // Precompute display percentages using largest-remainder rounding so they sum to 100
  const displayPcts = useMemo(() => {
    if (totalWeight <= 0) return sorted.map(() => 0);
    const fractions = sorted.map(p => p.totalWeight / totalWeight);
    return roundPcts(fractions);
  }, [sorted, totalWeight]);

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
        If you guess {guess.toUpperCase()}...
      </h3>
      <div className="space-y-0">
        {visible.map((p, idx) => {
          const isSolve = p.pattern === 'GGGGG';
          let outcomeText: string;
          if (isSolve) {
            outcomeText = 'solved!';
          } else if (p.candidates.length <= 3) {
            outcomeText = p.candidates.map(c => c.toUpperCase()).join(', ');
          } else {
            outcomeText = `${p.candidates.length} remaining`;
          }
          const isLast = idx === visible.length - 1 && hiddenCount === 0;
          return (
            <div key={p.pattern} className="flex items-stretch text-xs">
              {/* Left gutter: connecting line */}
              <div className="relative w-5 shrink-0">
                <div className={`absolute left-2 top-0 w-px bg-zinc-300 dark:bg-zinc-700 ${isLast ? 'h-1/2' : 'h-full'}`} />
                <div className="absolute left-[5px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full border border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-900" />
              </div>
              {/* Row content */}
              <div className="flex flex-1 items-center gap-2 py-1.5">
                <div className="flex gap-0.5">
                  {p.pattern.split('').map((tile, i) => (
                    <TileSquare key={i} tile={tile} />
                  ))}
                </div>
                <span className="text-zinc-400 dark:text-zinc-600">&rarr;</span>
                <span className={`flex-1 ${isSolve ? 'text-green-600 dark:text-green-400 font-medium' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {outcomeText}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600 tabular-nums text-[10px]">{displayPcts[idx] === 0 ? '0%' : displayPcts[idx] < 1 ? '<1%' : `${displayPcts[idx]}%`}</span>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="flex items-stretch text-xs">
            <div className="relative w-5 shrink-0">
              <div className="absolute left-2 top-0 w-px bg-zinc-300 dark:bg-zinc-700 h-1/2" />
              <div className="absolute left-[5px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full border border-zinc-400 bg-white dark:border-zinc-600 dark:bg-zinc-900" />
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="py-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline-offset-2 hover:underline"
            >
              {hiddenCount} more outcome{hiddenCount === 1 ? '' : 's'}...
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

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
            bg = 'bg-blue-100 border-blue-300 dark:bg-blue-600/20 dark:border-blue-500/50';
            textColor = 'text-blue-700 dark:text-blue-300';
          } else if (status === 'correct') {
            bg = 'bg-green-100 border-green-300 dark:bg-green-600/20 dark:border-green-500/50';
            textColor = 'text-green-700 dark:text-green-300';
          } else if (status === 'present') {
            bg = 'bg-yellow-100 border-yellow-300 dark:bg-yellow-600/20 dark:border-yellow-500/50';
            textColor = 'text-yellow-700 dark:text-yellow-300';
          } else {
            bg = 'bg-zinc-100 border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700';
            textColor = 'text-zinc-400 dark:text-zinc-500 line-through';
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

/** Format a percentage: 0 → "0%", >0 but <1% → "<1%", otherwise round to integer. */
function fmtPct(v: number): string {
  const pct = v * 100;
  if (pct === 0) return '0%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/**
 * Largest-remainder rounding: round fractions to integers that sum to 100.
 * Each input is a proportion (0–1). Returns integer percentages.
 */
function roundPcts(fractions: number[]): number[] {
  const raw = fractions.map(f => f * 100);
  const floored = raw.map(r => Math.floor(r));
  let remainder = 100 - floored.reduce((a, b) => a + b, 0);
  // Distribute remainder to entries with largest fractional parts
  const indexed = raw.map((r, i) => ({ i, frac: r - floored[i] }));
  indexed.sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < remainder; j++) {
    floored[indexed[j].i]++;
  }
  return floored;
}

function fmtScore(v: number): string {
  return `${v.toFixed(2)} bits`;
}

function StatsSummary({ analysis, score, guess, candidateCount, comparisonGuess, comparisonAnalysis, comparisonScore }: {
  analysis: GuessAnalysis;
  score: number;
  guess: string;
  candidateCount: number;
  comparisonGuess?: string;
  comparisonAnalysis?: GuessAnalysis;
  comparisonScore?: number;
}) {
  const isComparison = comparisonGuess != null && comparisonAnalysis != null;

  // Compute solve chance display using the same sort order + rounding as PatternOutcomes
  function solveChanceRounded(a: GuessAnalysis): string {
    const sorted = [...a.partitions].sort((x, y) => {
      if (x.pattern === 'GGGGG') return 1;
      if (y.pattern === 'GGGGG') return -1;
      return y.candidates.length - x.candidates.length;
    });
    const total = sorted.reduce((s, p) => s + p.totalWeight, 0);
    if (total <= 0) return '0%';
    const fractions = sorted.map(p => p.totalWeight / total);
    const rounded = roundPcts(fractions);
    const solveIdx = sorted.findIndex(p => p.pattern === 'GGGGG');
    if (solveIdx === -1) return '0%';
    const pct = rounded[solveIdx];
    return pct < 1 ? '<1%' : `${pct}%`;
  }

  const stats = [
    {
      label: 'Info score',
      value: score,
      format: fmtScore,
      compare: comparisonScore,
      better: (a: number, b: number) => a > b,
    },
    {
      label: 'Outcomes',
      value: analysis.partitions.length,
      format: (v: number) => `${v} of ${candidateCount}`,
      compare: comparisonAnalysis?.partitions.length,
      better: (a: number, b: number) => a > b,
    },
    {
      label: 'Solve chance',
      value: analysis.solveChance,
      format: () => solveChanceRounded(analysis),
      compare: comparisonAnalysis?.solveChance,
      formatCompare: comparisonAnalysis ? () => solveChanceRounded(comparisonAnalysis) : undefined,
      better: (a: number, b: number) => a > b,
    },
    {
      label: 'Worst case',
      value: analysis.worstCase,
      format: (v: number) => `${v} remaining`,
      compare: comparisonAnalysis?.worstCase,
      better: (a: number, b: number) => a < b,
    },
  ];

  if (isComparison) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 items-baseline">
          <div />
          <div className="font-semibold text-zinc-700 dark:text-zinc-300 text-center">{guess.toUpperCase()}</div>
          <div className="font-semibold text-zinc-500 text-center">{comparisonGuess!.toUpperCase()}</div>
          {stats.map((s) => {
            const formatted = s.format ? s.format(s.value) : String(s.value);
            const fmtComp = 'formatCompare' in s && s.formatCompare ? s.formatCompare : s.format;
            const compFormatted = s.compare != null ? (fmtComp ? fmtComp(s.compare) : String(s.compare)) : '';
            const isBetter = s.compare != null && s.better(s.value, s.compare);
            const isWorse = s.compare != null && s.better(s.compare, s.value);
            const colorClass = isBetter ? 'text-green-600 dark:text-green-400' : isWorse ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300';
            return [
              <div key={`${s.label}-l`} className="text-zinc-500">{s.label}</div>,
              <div key={`${s.label}-v`} className={`text-center tabular-nums ${colorClass}`}>{formatted}</div>,
              <div key={`${s.label}-c`} className="text-center tabular-nums text-zinc-500">{compFormatted}</div>,
            ];
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-2 dark:border-zinc-800 dark:bg-zinc-900/50">
      {stats.map((s) => {
        const formatted = s.format ? s.format(s.value) : String(s.value);
        return (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="text-zinc-500">{s.label}</span>
            <span className="text-zinc-700 dark:text-zinc-300 font-semibold tabular-nums">{formatted}</span>
          </div>
        );
      })}
    </section>
  );
}

export function AnalysisDrawer({ open, onClose, guess, candidates, weights, history, recommendedGuess }: AnalysisDrawerProps) {
  const isCustom = recommendedGuess != null && guess !== recommendedGuess;
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  const analysis = useMemo(() => {
    if (!open || !guess || candidates.length === 0) return null;
    return analyzeGuess(guess, candidates, weights);
  }, [open, guess, candidates, weights]);

  const score = useMemo(() => {
    if (!open || !guess || candidates.length === 0) return 0;
    return scoreGuessWeightedEntropy(guess, candidates, weights);
  }, [open, guess, candidates, weights]);

  const coverage = useMemo(() => {
    if (!open || !guess) return null;
    return letterCoverage(guess, history);
  }, [open, guess, history]);

  const recommendedAnalysis = useMemo(() => {
    if (!open || !isCustom || !recommendedGuess || candidates.length === 0) return null;
    return analyzeGuess(recommendedGuess, candidates, weights);
  }, [open, isCustom, recommendedGuess, candidates, weights]);

  const recommendedScore = useMemo(() => {
    if (!open || !isCustom || !recommendedGuess || candidates.length === 0) return 0;
    return scoreGuessWeightedEntropy(recommendedGuess, candidates, weights);
  }, [open, isCustom, recommendedGuess, candidates, weights]);

  if (!open || !analysis || !coverage) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed z-50 overflow-y-auto bg-white border-zinc-200 text-zinc-900 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100
        inset-x-0 bottom-0 top-[30vh] rounded-t-2xl border-t
        md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-80 md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-3 border-b border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">
              {isCustom ? `Analyzing ${guess.toUpperCase()}` : `Why ${guess.toUpperCase()}?`}
            </h2>
            {isCustom && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                vs. solver pick {recommendedGuess.toUpperCase()}
              </p>
            )}
          </div>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label="Close analysis">&times;</button>
        </div>
        <div className="px-4 py-4 space-y-6">
          <StatsSummary
            analysis={analysis}
            score={score}
            guess={guess}
            candidateCount={candidates.length}
            comparisonGuess={isCustom ? recommendedGuess : undefined}
            comparisonAnalysis={isCustom ? recommendedAnalysis ?? undefined : undefined}
            comparisonScore={isCustom ? recommendedScore : undefined}
          />
          <PatternOutcomes analysis={analysis} guess={guess} />
          <LetterCoverageSection coverage={coverage} guess={guess} />
        </div>
      </div>
    </>
  );
}
