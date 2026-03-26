import { feedbackPattern, Pattern } from './feedback';

export type NextGuessFastOptions = {
  candidates: readonly string[];
  /** Optional candidate prior weights (same length as candidates). */
  weights?: readonly number[];
  allowedGuesses: readonly string[];
  finishThreshold?: number;
  /** Number of guesses to fully score with entropy (picked by heuristic). */
  shortlistSize?: number;
  /** Enable two-step lookahead when candidates are within this range. */
  lookaheadThreshold?: number;
};

function entropyFromBucketWeights(totalWeight: number, bucketWeights: number[]): number {
  let h = 0;
  for (const w of bucketWeights) {
    const p = w / totalWeight;
    if (p <= 0) continue;
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

/**
 * Cheap heuristic to rank guesses before running full entropy.
 * Uses candidate letter frequencies (overall + positional) to approximate information gain.
 */
export function heuristicScore(guess: string, letterFreq: number[], posFreq: number[][]): number {
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

export function buildFreqs(candidates: readonly string[], weights?: readonly number[]) {
  const letterFreq = Array(26).fill(0);
  const posFreq = Array.from({ length: 5 }, () => Array(26).fill(0));

  let total = 0;
  for (let idx = 0; idx < candidates.length; idx++) {
    const w = candidates[idx];
    const ww = weights ? (weights[idx] ?? 0) : 1;
    if (ww <= 0) continue;
    total += ww;
    const seen = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const code = w.charCodeAt(i) - 97;
      if (code < 0 || code >= 26) continue;
      posFreq[i][code] += ww;
      if (!seen.has(code)) {
        seen.add(code);
        letterFreq[code] += ww;
      }
    }
  }

  const n = total || 1;
  for (let c = 0; c < 26; c++) letterFreq[c] /= n;
  for (let i = 0; i < 5; i++) for (let c = 0; c < 26; c++) posFreq[i][c] /= n;

  return { letterFreq, posFreq };
}

/**
 * Two-step lookahead: for a given guess, compute the expected number of
 * remaining candidates after the best possible second guess.
 *
 * Lower is better (fewer remaining candidates = closer to solving).
 */
function twoStepExpectedRemaining(
  guess: string,
  candidates: readonly string[],
  weights: readonly number[] | undefined,
  allowedGuesses: readonly string[],
): number {
  // Partition candidates into buckets by feedback pattern.
  const buckets = new Map<Pattern, { indices: number[]; totalWeight: number }>();
  let grandTotal = 0;

  for (let i = 0; i < candidates.length; i++) {
    const w = weights ? (weights[i] ?? 0) : 1;
    if (w <= 0) continue;
    grandTotal += w;
    const p = feedbackPattern(guess, candidates[i]);
    const existing = buckets.get(p);
    if (existing) {
      existing.indices.push(i);
      existing.totalWeight += w;
    } else {
      buckets.set(p, { indices: [i], totalWeight: w });
    }
  }

  if (grandTotal <= 0) return Infinity;

  let expectedRemaining = 0;

  for (const [pattern, bucket] of buckets) {
    const bucketProb = bucket.totalWeight / grandTotal;

    // All green — solved!
    if (pattern === 'GGGGG') {
      // contributes 0 remaining
      continue;
    }

    // Bucket of 1 — next guess is trivially the answer.
    if (bucket.indices.length === 1) {
      // contributes 1 remaining (but we know which one)
      expectedRemaining += bucketProb * 1;
      continue;
    }

    // Bucket of 2 — guess one, if wrong the other is the answer.
    if (bucket.indices.length === 2) {
      expectedRemaining += bucketProb * 1.5; // average 1.5 effective remaining
      continue;
    }

    // For larger buckets, find the best second guess by entropy.
    const subCandidates = bucket.indices.map((i) => candidates[i]);
    const subWeights = weights ? bucket.indices.map((i) => weights[i]) : undefined;

    // Build frequency heuristic for this sub-problem to pick a small shortlist.
    const { letterFreq, posFreq } = buildFreqs(subCandidates, subWeights);

    // Shortlist: top 30 from allowed guesses + all sub-candidates.
    const probeScored = allowedGuesses.map((g) => ({ g, s: heuristicScore(g, letterFreq, posFreq) }));
    probeScored.sort((a, b) => b.s - a.s);
    const shortlist = new Set<string>(probeScored.slice(0, 30).map((x) => x.g));
    for (const c of subCandidates) shortlist.add(c);

    // Find best second guess by entropy on this sub-problem.
    let bestSubEntropy = -Infinity;
    for (const g2 of shortlist) {
      const e = subWeights
        ? scoreGuessWeightedEntropy(g2, subCandidates, subWeights)
        : scoreGuessEntropy(g2, subCandidates);
      if (e > bestSubEntropy) bestSubEntropy = e;
    }

    // Convert entropy to expected remaining candidates.
    // With entropy H, we expect ~N/2^H remaining candidates.
    const n = subCandidates.length;
    const remaining = bestSubEntropy > 0 ? n / Math.pow(2, bestSubEntropy) : n;
    expectedRemaining += bucketProb * Math.max(1, remaining);
  }

  return expectedRemaining;
}

export function bestNextGuessHeuristic(opts: NextGuessFastOptions): { guess: string; score: number } {
  const { candidates, allowedGuesses, weights, finishThreshold = 50, shortlistSize = 2500, lookaheadThreshold = 200 } = opts;
  if (candidates.length === 0) throw new Error('No candidates remain (inconsistent feedback?)');
  if (candidates.length === 1) return { guess: candidates[0], score: Number.POSITIVE_INFINITY };

  // If close to finishing, entropy-score candidates and top probe words,
  // giving a small bonus to actual candidates (since they could be the answer).
  const candidateSet = new Set(candidates);
  if (candidates.length <= finishThreshold) {
    const { letterFreq, posFreq } = buildFreqs(candidates, weights);

    // Also consider top probe words in case one is strictly better
    const probeScored = allowedGuesses
      .filter((g) => !candidateSet.has(g))
      .map((g) => ({ g, s: heuristicScore(g, letterFreq, posFreq) }));
    probeScored.sort((a, b) => b.s - a.s);
    const topProbes = probeScored.slice(0, Math.min(200, probeScored.length)).map((x) => x.g);

    const searchSpace = [...candidates, ...topProbes];

    // Candidate bonus: a candidate guess that happens to be the answer instantly solves,
    // saving a guess. The expected value of this is simply p (the probability it's right).
    // We use p directly rather than p * log2(1/p) (self-information) because the latter
    // peaks at p ≈ 0.37 and incorrectly favors low-probability candidates over high-probability ones.
    const totalWeight = weights ? weights.reduce((a, b) => a + b, 0) : candidates.length;
    const candidateWeightMap = new Map<string, number>();
    for (let i = 0; i < candidates.length; i++) {
      candidateWeightMap.set(candidates[i], weights ? weights[i] : 1);
    }

    let bestGuess = candidates[0];
    let bestScore = -Infinity;
    for (const g of searchSpace) {
      let s = weights ? scoreGuessWeightedEntropy(g, candidates, weights) : scoreGuessEntropy(g, candidates);
      if (candidateSet.has(g) && totalWeight > 0) {
        const gWeight = candidateWeightMap.get(g) ?? 0;
        if (gWeight > 0) {
          const p = gWeight / totalWeight;
          s += p;
        }
      }
      if (s > bestScore) {
        bestScore = s;
        bestGuess = g;
      }
    }
    return { guess: bestGuess, score: bestScore };
  }

  const { letterFreq, posFreq } = buildFreqs(candidates, weights);

  // 1) Heuristic shortlist
  const scored = allowedGuesses.map((g) => ({ g, s: heuristicScore(g, letterFreq, posFreq) }));
  scored.sort((a, b) => b.s - a.s);
  const shortlist = scored.slice(0, Math.min(shortlistSize, scored.length)).map((x) => x.g);

  // 2) Full entropy on shortlist
  const entropyScored: Array<{ g: string; entropy: number }> = [];
  for (const g of shortlist) {
    const s = weights ? scoreGuessWeightedEntropy(g, candidates, weights) : scoreGuessEntropy(g, candidates);
    entropyScored.push({ g, entropy: s });
  }
  entropyScored.sort((a, b) => b.entropy - a.entropy);

  // 3) Two-step lookahead on the top entropy-scoring guesses.
  // Only when candidate count is in a range where lookahead is both
  // useful (>2 candidates) and feasible (not too many to be slow).
  if (candidates.length >= 3 && candidates.length <= lookaheadThreshold) {
    // Take top N by entropy for lookahead re-ranking.
    const lookaheadPool = entropyScored.slice(0, Math.min(50, entropyScored.length));

    // Also include all candidates in the lookahead pool (they get a natural
    // advantage since guessing the answer immediately solves it).
    const poolSet = new Set(lookaheadPool.map((x) => x.g));
    for (const c of candidates) {
      if (!poolSet.has(c)) {
        const e = weights ? scoreGuessWeightedEntropy(c, candidates, weights) : scoreGuessEntropy(c, candidates);
        lookaheadPool.push({ g: c, entropy: e });
      }
    }

    let bestGuess = lookaheadPool[0].g;
    let bestExpected = Infinity;
    let bestEntropy = lookaheadPool[0].entropy;

    for (const { g, entropy } of lookaheadPool) {
      const expected = twoStepExpectedRemaining(g, candidates, weights, allowedGuesses);
      // Prefer lower expected remaining; break ties with higher entropy.
      if (expected < bestExpected || (expected === bestExpected && entropy > bestEntropy)) {
        bestExpected = expected;
        bestGuess = g;
        bestEntropy = entropy;
      }
    }

    return { guess: bestGuess, score: bestEntropy };
  }

  // Fallback: use single-step entropy when lookahead isn't applicable.
  const best = entropyScored[0];
  return { guess: best.g, score: best.entropy };
}
