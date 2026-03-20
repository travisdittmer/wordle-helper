'use client';

import { FeedbackTiles } from './FeedbackTiles';
import type { Tile } from '@/lib/wordle/feedback';

interface FeedbackEntryProps {
  guess: string;
  onGuessChange: (guess: string) => void;
  tiles: Tile[];
  onTilesChange: (tiles: Tile[]) => void;
  onApply: () => void;
  onUndo?: () => void;
  onReset?: () => void;
  error: string | null;
  dataWarning: string | null;
  statusLabel: string | null;
  onUseSolverPick?: () => void;
  onAnalyze?: () => void;
  showHistoryActions: boolean;
}

export function FeedbackEntry({
  guess,
  onGuessChange,
  tiles,
  onTilesChange,
  onApply,
  onUndo,
  onReset,
  error,
  dataWarning,
  statusLabel,
  onUseSolverPick,
  onAnalyze,
  showHistoryActions,
}: FeedbackEntryProps) {
  return (
    <div>
      {statusLabel && (
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{statusLabel}</span>
          {onUseSolverPick && (
            <button
              onClick={onUseSolverPick}
              className="text-zinc-300 underline-offset-2 hover:underline"
            >
              Use solver pick
            </button>
          )}
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="text-blue-400 underline-offset-2 hover:underline hover:text-blue-300"
            >
              Analyze this
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="guess-input" className="sr-only">Your guess</label>
        <input
          id="guess-input"
          value={guess}
          onChange={(e) => onGuessChange(e.target.value)}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="guess"
          className="w-36 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-lg font-semibold tracking-widest lowercase outline-none focus:border-zinc-500 dark:border-zinc-700 dark:placeholder:text-zinc-600"
          maxLength={5}
        />
        <div className="flex gap-3 text-xs">
          <button
            onClick={() => onTilesChange(['B', 'B', 'B', 'B', 'B'])}
            className="px-2 py-1 -mx-2 -my-1 text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
          >
            clear tiles
          </button>
          {showHistoryActions && (
            <>
              {onUndo && <button onClick={onUndo} className="text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline">undo</button>}
              {onReset && <button onClick={onReset} className="text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline">reset</button>}
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <FeedbackTiles tiles={tiles} guess={guess} onTilesChange={onTilesChange} />
      </div>

      {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
      {dataWarning && <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">{dataWarning}</div>}

      <button
        onClick={onApply}
        className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Apply
      </button>
    </div>
  );
}
