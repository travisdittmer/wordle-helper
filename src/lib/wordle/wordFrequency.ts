/**
 * Word frequency / commonality scoring.
 *
 * Wordle answers are curated common English words. This module provides a
 * frequency prior so the solver can prefer common words (HOUSE, WATER, LIGHT)
 * over obscure ones (FJORD, GLYPH, NYMPH).
 *
 * Approach: score each word using English letter-bigram log-frequencies as a
 * proxy for overall word familiarity. Words with common letter sequences score
 * higher. This correlates well with word frequency in practice.
 */

// Letter unigram frequencies in English (approximate, from large corpora).
// Normalized so max = 1.
const UNIGRAM: Record<string, number> = {
  e: 1.0, t: 0.75, a: 0.65, o: 0.60, i: 0.58, n: 0.56, s: 0.53, h: 0.50,
  r: 0.49, d: 0.35, l: 0.33, c: 0.23, u: 0.23, m: 0.20, w: 0.19, f: 0.18,
  g: 0.17, y: 0.16, p: 0.16, b: 0.12, v: 0.08, k: 0.06, j: 0.01, x: 0.01,
  q: 0.01, z: 0.01,
};

// Common English bigrams scored 0-1 (top ~80 bigrams from corpora).
const BIGRAM: Record<string, number> = {
  th: 1.0, he: 0.95, in: 0.85, er: 0.82, an: 0.78, re: 0.75, on: 0.72,
  at: 0.68, en: 0.65, nd: 0.62, ti: 0.58, es: 0.56, or: 0.54, te: 0.52,
  of: 0.50, ed: 0.48, is: 0.46, it: 0.44, al: 0.42, ar: 0.40, st: 0.38,
  to: 0.36, nt: 0.34, ng: 0.32, se: 0.30, ha: 0.28, as: 0.27, ou: 0.26,
  io: 0.25, le: 0.24, ve: 0.23, co: 0.22, me: 0.21, de: 0.20, hi: 0.19,
  ri: 0.18, ro: 0.17, ic: 0.16, ne: 0.16, ea: 0.15, ra: 0.14, ce: 0.13,
  li: 0.12, ch: 0.12, ll: 0.11, be: 0.11, ma: 0.10, si: 0.10, om: 0.09,
  ur: 0.09, ca: 0.08, el: 0.08, ta: 0.08, la: 0.07, ns: 0.07, ge: 0.06,
  ai: 0.06, ol: 0.06, et: 0.05, da: 0.05, ni: 0.05, us: 0.05,
  sh: 0.05, ow: 0.04, ck: 0.04, id: 0.04, ig: 0.04, ly: 0.04, ee: 0.04,
  oo: 0.03, ss: 0.03, tt: 0.03, bl: 0.03, pl: 0.03, cr: 0.03, tr: 0.03,
  cl: 0.03, sp: 0.03, sw: 0.02, fl: 0.02, pr: 0.02, gr: 0.02, br: 0.02,
  dr: 0.02, fr: 0.02, wh: 0.02, wr: 0.01, kn: 0.01, ght: 0.01,
};

/**
 * Score a single word for "commonality" (0 to ~1 scale, higher = more common).
 * Uses average bigram frequency + letter frequency as proxy.
 */
export function wordCommonalityScore(word: string): number {
  const w = word.toLowerCase();
  if (w.length < 2) return 0;

  // Bigram component: average bigram score across the word.
  let bigramSum = 0;
  for (let i = 0; i < w.length - 1; i++) {
    const bg = w[i] + w[i + 1];
    bigramSum += BIGRAM[bg] ?? 0;
  }
  const bigramAvg = bigramSum / (w.length - 1);

  // Unigram component: average letter frequency.
  let unigramSum = 0;
  for (let i = 0; i < w.length; i++) {
    unigramSum += UNIGRAM[w[i]] ?? 0;
  }
  const unigramAvg = unigramSum / w.length;

  // Penalty for rare/unusual letters (q without u, double-uncommon, etc.)
  let rarePenalty = 0;
  for (let i = 0; i < w.length; i++) {
    const u = UNIGRAM[w[i]] ?? 0;
    if (u < 0.05) rarePenalty += 0.1;
  }

  // Combined score weighted 60% bigram, 40% unigram, minus rare penalty.
  return Math.max(0, bigramAvg * 0.6 + unigramAvg * 0.4 - rarePenalty);
}

/**
 * Compute frequency-based weights for a candidate list.
 * Returns weights in [0.2, 1.0] range — even rare words get some weight
 * since Wordle occasionally uses them.
 *
 * @param candidates - The list of candidate words.
 * @returns Array of weights (same length as candidates).
 */
export function frequencyWeights(candidates: readonly string[]): number[] {
  if (candidates.length === 0) return [];

  const raw = candidates.map(wordCommonalityScore);
  const maxScore = Math.max(...raw, 0.001); // avoid division by zero

  // Normalize to [0, 1], then map to [MIN_WEIGHT, 1.0].
  const MIN_WEIGHT = 0.2;
  return raw.map((r) => {
    const normalized = r / maxScore;
    return MIN_WEIGHT + normalized * (1 - MIN_WEIGHT);
  });
}
