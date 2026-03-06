'use client';

import { Tile } from '@/lib/wordle/feedback';

const TILE_ORDER: Tile[] = ['B', 'Y', 'G'];

function nextTile(t: Tile): Tile {
  const idx = TILE_ORDER.indexOf(t);
  return TILE_ORDER[(idx + 1) % TILE_ORDER.length];
}

function tileClass(t: Tile): string {
  switch (t) {
    case 'G':
      return 'bg-emerald-600 border-emerald-700 text-white';
    case 'Y':
      return 'bg-amber-500 border-amber-600 text-white';
    case 'B':
    default:
      return 'bg-zinc-300 border-zinc-400 text-zinc-900 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-50';
  }
}

interface FeedbackTilesProps {
  tiles: Tile[];
  guess: string;
  onTilesChange: (tiles: Tile[]) => void;
}

export function FeedbackTiles({ tiles, guess, onTilesChange }: FeedbackTilesProps) {
  const allDefault = tiles.every((t) => t === 'B');

  return (
    <div>
      <div className="flex gap-2">
        {tiles.map((t, i) => (
          <button
            key={i}
            onClick={() => onTilesChange(tiles.map((x, j) => (j === i ? nextTile(x) : x)))}
            className={`h-12 w-12 rounded-lg text-lg font-bold transition-all duration-150 active:scale-95 ${tileClass(t)} ${allDefault ? 'border-2 shadow-md shadow-zinc-700/30' : 'border'}`}
            aria-label={`Tile ${i + 1}: ${t === 'B' ? 'gray' : t === 'Y' ? 'yellow' : 'green'}`}
          >
            {guess[i]?.toUpperCase() ?? ''}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {allDefault
          ? 'Tap each tile to set the color Wordle showed you'
          : 'Tap tiles to cycle: gray \u2192 yellow \u2192 green'}
      </div>
    </div>
  );
}
