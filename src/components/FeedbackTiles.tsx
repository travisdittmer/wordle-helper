'use client';

import { useState } from 'react';
import { Tile } from '@/lib/wordle/feedback';

const TILE_ORDER: Tile[] = ['B', 'Y', 'G'];

function nextTile(t: Tile): Tile {
  const idx = TILE_ORDER.indexOf(t);
  return TILE_ORDER[(idx + 1) % TILE_ORDER.length];
}

function tileClass(t: Tile): string {
  switch (t) {
    case 'G':
      return 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-900/30';
    case 'Y':
      return 'bg-amber-500 border-amber-600 text-white shadow-amber-900/30';
    case 'B':
    default:
      return 'bg-zinc-300 border-zinc-400 text-zinc-900 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-50 shadow-zinc-900/10';
  }
}

function tileName(t: Tile): string {
  switch (t) {
    case 'G': return 'Green';
    case 'Y': return 'Yellow';
    case 'B': return 'Gray';
    default: return 'Gray';
  }
}

interface FeedbackTilesProps {
  tiles: Tile[];
  guess: string;
  onTilesChange: (tiles: Tile[]) => void;
}

export function FeedbackTiles({ tiles, guess, onTilesChange }: FeedbackTilesProps) {
  const allDefault = tiles.every((t) => t === 'B');
  const [bouncingIdx, setBouncingIdx] = useState<number | null>(null);

  function handleTileTap(i: number) {
    onTilesChange(tiles.map((x, j) => (j === i ? nextTile(x) : x)));
    setBouncingIdx(i);
    setTimeout(() => setBouncingIdx(null), 200);
  }

  return (
    <div>
      <div className="flex gap-2">
        {tiles.map((t, i) => (
          <button
            key={i}
            onClick={() => handleTileTap(i)}
            className={`h-12 w-12 rounded-lg text-lg font-bold shadow-md transition-all duration-150 ${tileClass(t)} ${allDefault ? 'border-2' : 'border'} ${bouncingIdx === i ? 'scale-110' : 'active:scale-95'}`}
            style={bouncingIdx === i ? { transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' } : undefined}
            aria-label={`Tile ${i + 1}: ${tileName(t)}. Tap to change.`}
          >
            {guess[i]?.toUpperCase() ?? ''}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {allDefault
          ? 'Tap each tile to set the color Wordle showed you'
          : tiles.map(tileName).join(' \u00B7 ')}
      </div>
    </div>
  );
}
