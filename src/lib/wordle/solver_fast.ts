import { feedbackPattern, Pattern } from './feedback';

export type NextGuessFastOptions = {
  candidates: readonly string[];
  allowedGuesses: readonly string[];
  finishThreshold?: number;
  /** Number of guesses to fully score with entropy (picked by heuristic). */
  shortlistSize?: number;
};

function entropyFromBucketSizes(total: number, sizes: number[]): number {
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

/**
 * Cheap heuristic to rank guesses before running full entropy.
 * Uses candidate letter frequencies (overall + positional) to approximate information gain.
 */
function heuristicScore(guess: string, letterFreq: number[], posFreq: number[][]): number {
  const seen = new Set<number>();
  let s = 0;
  for (let i = 0; i < 5; i++) {
    const code = guess.charCodeAt(i) - 97;
    if (code < 0 || code >= 26) continue;
    // reward positional match likelihood (greens)
    s += posFreq[i][code] * 1.2;
    // reward covering common letters, but only once per letter
    if (!seen.has(code)) {
      seen.add(code);
      s += letterFreq[code];
    }
  }
  return s;
}

function buildFreqs(candidates: readonly string[]) {
  const letterFreq = Array(26).fill(0);
  const posFreq = Array.from({ length: 5 }, () => Array(26).fill(0));

  for (const w of candidates) {
    const seen = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const code = w.charCodeAt(i) - 97;
      if (code < 0 || code >= 26) continue;
      posFreq[i][code] += 1;
      if (!seen.has(code)) {
        seen.add(code);
        letterFreq[code] += 1;
      }
    }
  }

  const n = candidates.length || 1;
  for (let c = 0; c < 26; c++) letterFreq[c] /= n;
  for (let i = 0; i < 5; i++) for (let c = 0; c < 26; c++) posFreq[i][c] /= n;

  return { letterFreq, posFreq };
}

export function bestNextGuessHeuristic(opts: NextGuessFastOptions): { guess: string; score: number } {
  const { candidates, allowedGuesses, finishThreshold = 15, shortlistSize = 2500 } = opts;
  if (candidates.length === 0) throw new Error('No candidates remain (inconsistent feedback?)');
  if (candidates.length === 1) return { guess: candidates[0], score: Number.POSITIVE_INFINITY };

  // If close to finishing, just entropy-score candidates directly.
  if (candidates.length <= finishThreshold) {
    let bestGuess = candidates[0];
    let bestScore = -Infinity;
    for (const g of candidates) {
      const s = scoreGuessEntropy(g, candidates);
      if (s > bestScore) {
        bestScore = s;
        bestGuess = g;
      }
    }
    return { guess: bestGuess, score: bestScore };
  }

  const { letterFreq, posFreq } = buildFreqs(candidates);

  // 1) Heuristic shortlist
  const scored = allowedGuesses.map((g) => ({ g, s: heuristicScore(g, letterFreq, posFreq) }));
  scored.sort((a, b) => b.s - a.s);
  const shortlist = scored.slice(0, Math.min(shortlistSize, scored.length)).map((x) => x.g);

  // 2) Full entropy on shortlist
  let bestGuess = shortlist[0];
  let bestScore = -Infinity;
  for (const g of shortlist) {
    const s = scoreGuessEntropy(g, candidates);
    if (s > bestScore) {
      bestScore = s;
      bestGuess = g;
    }
  }

  return { guess: bestGuess, score: bestScore };
}
