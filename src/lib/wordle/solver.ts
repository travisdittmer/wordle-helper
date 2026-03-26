import { feedbackPattern, Pattern } from './feedback';
import { heuristicScore, buildFreqs } from './solver_fast';

export type ScoreMode = 'entropy';

export type NextGuessOptions = {
  /** Remaining possible answers. */
  candidates: readonly string[];
  /** Optional candidate prior weights (same length as candidates). */
  weights?: readonly number[];
  /** Words you're allowed to guess (can include probe words). */
  allowedGuesses: readonly string[];
  /** When candidates are <= this, prefer choosing an actual candidate (even if a probe has higher entropy). */
  finishThreshold?: number;
};

function entropyFromBucketWeights(totalWeight: number, bucketWeights: number[]): number {
  // H = sum p * log2(1/p)
  let h = 0;
  for (const w of bucketWeights) {
    const p = w / totalWeight;
    if (p <= 0) continue;
    h += p * Math.log2(1 / p);
  }
  return h;
}

export function scoreGuessEntropy(guess: string, candidates: readonly string[]): number {
  // Back-compat: uniform weights.
  const buckets = new Map<Pattern, number>();
  for (const ans of candidates) {
    const p = feedbackPattern(guess, ans);
    buckets.set(p, (buckets.get(p) ?? 0) + 1);
  }
  return entropyFromBucketWeights(candidates.length, Array.from(buckets.values()));
}

export function scoreGuessWeightedEntropy(guess: string, candidates: readonly string[], weights: readonly number[]): number {
  if (weights.length !== candidates.length) throw new Error('weights must match candidates length');
  const buckets = new Map<Pattern, number>();
  let total = 0;
  for (let i = 0; i < candidates.length; i++) {
    const ans = candidates[i];
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    total += w;
    const p = feedbackPattern(guess, ans);
    buckets.set(p, (buckets.get(p) ?? 0) + w);
  }
  if (total <= 0) return 0;
  return entropyFromBucketWeights(total, Array.from(buckets.values()));
}

export function bestNextGuess(opts: NextGuessOptions): { guess: string; score: number } {
  const { candidates, allowedGuesses, weights, finishThreshold = 15 } = opts;
  if (candidates.length === 0) throw new Error('No candidates remain (inconsistent feedback?)');
  if (candidates.length === 1) return { guess: candidates[0], score: Number.POSITIVE_INFINITY };

  // If we’re close to finishing, restrict to candidates.
  const searchSpace = candidates.length <= finishThreshold ? candidates : allowedGuesses;

  let bestGuess = searchSpace[0];
  let bestScore = -Infinity;

  for (const g of searchSpace) {
    const s = weights ? scoreGuessWeightedEntropy(g, candidates, weights) : scoreGuessEntropy(g, candidates);
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
  weights?: readonly number[];
  allowedGuesses: readonly string[];
  limit?: number;
  /** Max words to entropy-score (heuristic shortlist). 0 = score all. */
  shortlistSize?: number;
}): Array<{ guess: string; score: number }> {
  const { candidates, weights, allowedGuesses, limit = 10, shortlistSize = 3000 } = params;

  // Use heuristic shortlisting when the guess pool is large, matching
  // the same approach solver_fast uses for the main recommendation.
  let searchSpace: readonly string[];
  if (shortlistSize > 0 && allowedGuesses.length > shortlistSize) {
    const { letterFreq, posFreq } = buildFreqs(candidates, weights);
    const ranked = allowedGuesses.map((g) => ({ g, s: heuristicScore(g, letterFreq, posFreq) }));
    ranked.sort((a, b) => b.s - a.s);
    const shortlist = new Set(ranked.slice(0, shortlistSize).map((x) => x.g));
    // Always include actual candidates (they could be the answer).
    for (const c of candidates) shortlist.add(c);
    searchSpace = [...shortlist];
  } else {
    searchSpace = allowedGuesses;
  }

  const scored = searchSpace.map((g) => ({
    guess: g,
    score: weights ? scoreGuessWeightedEntropy(g, candidates, weights) : scoreGuessEntropy(g, candidates),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
