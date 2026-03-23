'use client';

import { useState, useTransition } from 'react';

interface GuessEntry {
  guess: string;
  score: number;
}

interface ExploreAlternativesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guesses: GuessEntry[];
  candidateSet: Set<string>;
  onSelectGuess: (guess: string) => void;
  candidateCount: number;
  totalCount: number;
  showSpeedNote: boolean;
}

function classifyGuess(g: GuessEntry, candidateSet: Set<string>): string | null {
  if (candidateSet.has(g.guess)) return null;
  return 'probe';
}

export function ExploreAlternatives({ open, onOpenChange, guesses, candidateSet, onSelectGuess, candidateCount, totalCount, showSpeedNote }: ExploreAlternativesProps) {
  const [count, setCount] = useState(10);
  const [isPending, startTransition] = useTransition();

  const visible = guesses.slice(0, count);

  return (
    <div>
      <button
        onClick={() => startTransition(() => onOpenChange(!open))}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <span className={`inline-block text-[10px] transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        <span className="font-medium">Explore alternatives</span>
        <span className="ml-auto text-xs text-zinc-500">{totalCount.toLocaleString()} possible &mdash; {candidateCount.toLocaleString()} remaining</span>
      </button>

      {open && isPending && (
        <div className="mt-1 flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/50 dark:bg-zinc-950">
          <span className="text-xs text-zinc-500 animate-pulse">Scoring guesses&hellip;</span>
        </div>
      )}

      {open && !isPending && (
        <div className="mt-1 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800/50 dark:bg-zinc-950">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-zinc-500">
              Ranked by information gain
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="alt-count" className="text-zinc-500">Show</label>
              <input
                id="alt-count"
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                className="w-14 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm tabular-nums"
                min={1}
                max={50}
              />
            </div>
          </div>

          <ul className="space-y-1">
            {visible.map((x) => {
              const tag = classifyGuess(x, candidateSet);
              return (
                <li key={x.guess} className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <button
                      className="font-mono text-sm font-semibold tracking-wide underline-offset-2 hover:underline"
                      onClick={() => onSelectGuess(x.guess)}
                      title="Use this guess"
                    >
                      {x.guess.toUpperCase()}
                    </button>
                    {tag && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        {tag}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-zinc-500">{x.score.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>

          {showSpeedNote && (
            <div className="mt-2 text-[10px] text-zinc-600">
              Showing a subset for speed. Full search available with fewer candidates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
