'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import type { Pattern } from '@/lib/wordle/feedback';
import { analyzeGuess, letterCoverage, type GuessAnalysis, type LetterCoverageResult } from '@/lib/wordle/analysis';

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
  const bg = tile === 'G' ? 'bg-green-600' : tile === 'Y' ? 'bg-yellow-500' : 'bg-zinc-700';
  return <span className={`inline-block h-4 w-4 rounded-sm ${bg}`} />;
}

function PatternOutcomes({ analysis, guess }: { analysis: GuessAnalysis; guess: string }) {
  const [expanded, setExpanded] = useState(false);
  const threshold = 25;
  const showAll = analysis.partitions.length <= threshold || expanded;
  const visible = showAll ? analysis.partitions : analysis.partitions.slice(0, 15);
  const hiddenCount = analysis.partitions.length - visible.length;
  const totalWeight = analysis.partitions.reduce((sum, p) => sum + p.totalWeight, 0);

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
                <div className={`absolute left-2 top-0 w-px bg-zinc-700 ${isLast ? 'h-1/2' : 'h-full'}`} />
                <div className="absolute left-[5px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full border border-zinc-600 bg-zinc-900" />
              </div>
              {/* Row content */}
              <div className="flex flex-1 items-center gap-2 py-1.5">
                <div className="flex gap-0.5">
                  {p.pattern.split('').map((tile, i) => (
                    <TileSquare key={i} tile={tile} />
                  ))}
                </div>
                <span className="text-zinc-600">&rarr;</span>
                <span className={`flex-1 ${isSolve ? 'text-green-400 font-medium' : 'text-zinc-300'}`}>
                  {outcomeText}
                </span>
                <span className="text-zinc-600 tabular-nums text-[10px]">{fmtPct(totalWeight > 0 ? p.totalWeight / totalWeight : 0)}</span>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="flex items-stretch text-xs">
            <div className="relative w-5 shrink-0">
              <div className="absolute left-2 top-0 w-px bg-zinc-700 h-1/2" />
              <div className="absolute left-[5px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full border border-zinc-600 bg-zinc-900" />
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="py-1.5 text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
            >
              {hiddenCount} more pattern{hiddenCount === 1 ? '' : 's'}...
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

/** Format a percentage: 0 → "0%", >0 but <1% → "<1%", otherwise round to integer. */
function fmtPct(v: number): string {
  const pct = v * 100;
  if (pct === 0) return '0%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

function StatsSummary({ analysis, candidateCount, comparisonGuess, comparisonAnalysis }: {
  analysis: GuessAnalysis;
  candidateCount: number;
  comparisonGuess?: string;
  comparisonAnalysis?: GuessAnalysis;
}) {
  const isComparison = comparisonGuess != null && comparisonAnalysis != null;

  const stats = [
    {
      label: 'Splits into',
      value: analysis.partitions.length,
      detail: `${candidateCount} → ${analysis.partitions.length} groups`,
      compare: comparisonAnalysis?.partitions.length,
      better: (a: number, b: number) => a >= b,
    },
    {
      label: 'Solve chance',
      value: analysis.solveChance,
      format: fmtPct,
      detail: analysis.solveChance > 0 ? 'could be the answer' : 'info-gathering probe',
      compare: comparisonAnalysis?.solveChance,
      better: (a: number, b: number) => a >= b,
    },
    {
      label: 'Worst case',
      value: analysis.worstCase,
      detail: analysis.worstCase <= 1 ? 'narrows to 1' : `${analysis.worstCase} left at worst`,
      compare: comparisonAnalysis?.worstCase,
      better: (a: number, b: number) => a <= b,
    },
  ];

  if (isComparison) {
    return (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="text-zinc-500" />
          <div className="font-semibold text-zinc-300">You</div>
          <div className="font-semibold text-zinc-500">{comparisonGuess!.toUpperCase()}</div>
          {stats.map((s) => {
            const formatted = s.format ? s.format(s.value) : String(s.value);
            const compFormatted = s.compare != null ? (s.format ? s.format(s.compare) : String(s.compare)) : '';
            const isBetter = s.compare != null && s.better(s.value, s.compare);
            return [
              <div key={`${s.label}-l`} className="text-left text-zinc-500">{s.label}</div>,
              <div key={`${s.label}-v`} className={isBetter ? 'text-green-400' : s.compare != null && !s.better(s.value, s.compare) ? 'text-amber-400' : 'text-zinc-300'}>{formatted}</div>,
              <div key={`${s.label}-c`} className="text-zinc-500">{compFormatted}</div>,
            ];
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs space-y-2.5">
      {stats.map((s) => {
        const formatted = s.format ? s.format(s.value) : String(s.value);
        return (
          <div key={s.label} className="flex items-baseline justify-between">
            <div>
              <span className="text-zinc-500">{s.label}</span>
              <span className="ml-2 text-zinc-300 font-semibold">{formatted}</span>
            </div>
            <span className="text-[10px] text-zinc-600 max-w-[50%] text-right">{s.detail}</span>
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

  const coverage = useMemo(() => {
    if (!open || !guess) return null;
    return letterCoverage(guess, history);
  }, [open, guess, history]);

  const recommendedAnalysis = useMemo(() => {
    if (!open || !isCustom || !recommendedGuess || candidates.length === 0) return null;
    return analyzeGuess(recommendedGuess, candidates, weights);
  }, [open, isCustom, recommendedGuess, candidates, weights]);

  if (!open || !analysis || !coverage) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed z-50 overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100
        inset-x-0 bottom-0 top-[30vh] rounded-t-2xl border-t
        md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-80 md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-950 px-4 py-3 border-b border-zinc-800">
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
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" aria-label="Close analysis">&times;</button>
        </div>
        <div className="px-4 py-4 space-y-6">
          <StatsSummary
            analysis={analysis}
            candidateCount={candidates.length}
            comparisonGuess={isCustom ? recommendedGuess : undefined}
            comparisonAnalysis={isCustom ? recommendedAnalysis ?? undefined : undefined}
          />
          <PatternOutcomes analysis={analysis} guess={guess} />
          <LetterCoverageSection coverage={coverage} guess={guess} />
        </div>
      </div>
    </>
  );
}
