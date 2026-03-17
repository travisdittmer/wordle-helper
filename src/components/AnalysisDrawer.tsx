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
}

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

export function AnalysisDrawer({ open, onClose, guess, candidates, weights, history }: AnalysisDrawerProps) {
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
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed z-50 overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100
        inset-x-0 bottom-0 top-[30vh] rounded-t-2xl border-t
        md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-80 md:rounded-t-none md:rounded-l-2xl md:border-t-0 md:border-l">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-950 px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">Why {guess.toUpperCase()}?</h2>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" aria-label="Close analysis">&times;</button>
        </div>
        <div className="px-4 py-4 space-y-6">
          <PatternOutcomes analysis={analysis} guess={guess} />
          <LetterCoverageSection coverage={coverage} guess={guess} />
        </div>
      </div>
    </>
  );
}
