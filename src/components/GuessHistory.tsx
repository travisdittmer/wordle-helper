'use client';

import { Pattern, Tile } from '@/lib/wordle/feedback';

function tileClassSmall(t: Tile): string {
  switch (t) {
    case 'G':
      return 'bg-emerald-600 text-white';
    case 'Y':
      return 'bg-amber-500 text-white';
    case 'B':
    default:
      return 'bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50';
  }
}

interface GuessHistoryProps {
  history: Array<{ guess: string; pattern: Pattern }>;
}

export function GuessHistory({ history }: GuessHistoryProps) {
  if (history.length === 0) {
    return <div className="text-sm text-zinc-500 dark:text-zinc-400">No guesses yet.</div>;
  }

  return (
    <ul className="space-y-2">
      {history.map((h, idx) => (
        <li key={idx} className="flex items-center gap-1.5">
          {h.guess.split('').map((ch, ci) => (
            <div
              key={ci}
              className={`flex h-9 w-9 items-center justify-center rounded font-mono text-sm font-bold ${tileClassSmall(h.pattern[ci] as Tile)}`}
            >
              {ch.toUpperCase()}
            </div>
          ))}
          <span className="ml-2 text-xs text-zinc-400">{idx + 1}</span>
        </li>
      ))}
    </ul>
  );
}
