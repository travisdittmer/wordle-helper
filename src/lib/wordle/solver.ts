import { feedbackPattern, Pattern } from './feedback';

export type ScoreMode = 'entropy';

export type NextGuessOptions = {
  /** Remaining possible answers. */
  candidates: readonly string[];
  /** Words you're allowed to guess (can include probe words). */
  allowedGuesses: readonly string[];
  /** When candidates are <= this, prefer choosing an actual candidate (even if a probe has higher entropy). */
  finishThreshold?: number;
};

function entropyFromBucketSizes(total: number, sizes: number[]): number {
  // H = sum p * log2(1/p)
  let h = 0;
  for (const s of sizes) {
    const p = s / total;
    h += p * Math.log2(1 / p);
  }
  return h;
}

export function scoreGuessEntropy(guess: string, candidates: readonly string[]): number {
  const buckets = new Map<Pattern, number>();
  for (const ans of candidates) {
    const p = feedbackPattern(guess, ans);
    buckets.set(p, (buckets.get(p) ?? 0) + 1);
  }
  return entropyFromBucketSizes(candidates.length, Array.from(buckets.values()));
}

export function bestNextGuess(opts: NextGuessOptions): { guess: string; score: number } {
  const { candidates, allowedGuesses, finishThreshold = 15 } = opts;
  if (candidates.length === 0) throw new Error('No candidates remain (inconsistent feedback?)');
  if (candidates.length === 1) return { guess: candidates[0], score: Number.POSITIVE_INFINITY };

  // If we’re close to finishing, restrict to candidates.
  const searchSpace = candidates.length <= finishThreshold ? candidates : allowedGuesses;

  let bestGuess = searchSpace[0];
  let bestScore = -Infinity;

  for (const g of searchSpace) {
    const s = scoreGuessEntropy(g, candidates);
    if (s > bestScore) {
      bestScore = s;
      bestGuess = g;
    }
  }

  return { guess: bestGuess, score: bestScore };
}

export function filterCandidatesByFeedback(params: {
  candidates: readonly string[];
  guess: string;
  pattern: Pattern;
}): string[] {
  const { candidates, guess, pattern } = params;
  return candidates.filter((ans) => feedbackPattern(guess, ans) === pattern);
}

export function topGuesses(params: {
  candidates: readonly string[];
  allowedGuesses: readonly string[];
  limit?: number;
}): Array<{ guess: string; score: number }> {
  const { candidates, allowedGuesses, limit = 10 } = params;
  const scored = allowedGuesses.map((g) => ({ guess: g, score: scoreGuessEntropy(g, candidates) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
