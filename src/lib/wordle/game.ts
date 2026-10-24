import type { Pattern, Tile } from './feedback';

export const MAX_GUESSES = 6;

export type GameStatus = 'playing' | 'won' | 'lost';

type Row = { guess: string; pattern: Pattern };

/** Won only on all-green feedback; narrowing to one candidate is not a win. */
export function gameStatus(history: readonly Row[]): GameStatus {
  if (history.length > 0 && history[history.length - 1].pattern === 'GGGGG') return 'won';
  if (history.length >= MAX_GUESSES) return 'lost';
  return 'playing';
}

export function turnsLeft(history: readonly Row[]): number {
  return Math.max(0, MAX_GUESSES - history.length);
}

function patternToEmoji(pattern: Pattern): string {
  return pattern.split('').map((t) => {
    switch (t as Tile) {
      case 'G': return '\u{1F7E9}';
      case 'Y': return '\u{1F7E8}';
      default: return '\u{2B1B}';
    }
  }).join('');
}

/** Share text for a won game, one row per guess played; null otherwise. */
export function buildShareText(history: readonly Row[]): string | null {
  if (gameStatus(history) !== 'won') return null;
  const lines = history.map((h) => patternToEmoji(h.pattern));
  return `Wordle Helper → Solved in ${history.length}\n\n${lines.join('\n')}\n\nwordle.arco42.com`;
}
