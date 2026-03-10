/**
 * Historical Wordle answers ("word of the day") support.
 *
 * Since ~Feb 2, 2026, NYT reuses past answers at a ~11% rate (4 of 37 days).
 * All confirmed reuses have been words from 3.9-4.7 years ago.
 * Words used once get a small but non-zero weight; words used 2+ times get even less.
 *
 * NOTE: Answer list must be API-verified — the original planned answer list diverges
 * from what NYT actually uses. Run `npm run fetch:answers` with a cleared cache to re-verify.
 */

import { ANSWERS_BY_DATE } from './answersByDate';

// Wordle rollover time: 5:00 AM UTC (per community reverse-engineering and the source this list was built from)
const WORDLE_ROLLOVER_UTC_HOUR = 5;
// originDate: Wordle #1 = 2021-06-19 (cigar)
const ORIGIN_UTC_MS = Date.UTC(2021, 5, 19, WORDLE_ROLLOVER_UTC_HOUR, 0, 0);

export function todayKey(d = new Date()): string {
  // local date key (for cache partitioning / display only)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentWordleIndexUtc(now = new Date()): number {
  // Index into ANSWERS_BY_DATE for "today" given the 5:00 UTC rollover.
  // 0 => 2021-06-19 (cigar)
  const ms = now.getTime();
  const days = Math.floor((ms - ORIGIN_UTC_MS) / (24 * 60 * 60 * 1000));
  return days;
}

/** Returns how many times each word has been used as a past answer (before today). */
export function pastAnswerCounts(now = new Date()): Map<string, number> {
  const idx = currentWordleIndexUtc(now);
  const counts = new Map<string, number>();
  for (let i = 0; i < Math.min(idx, ANSWERS_BY_DATE.length); i++) {
    const w = ANSWERS_BY_DATE[i];
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
}

/** Convenience: returns the set of all known past answers (any use count). */
export function knownPastAnswers(now = new Date()): Set<string> {
  const idx = currentWordleIndexUtc(now);
  const past = new Set<string>();
  for (let i = 0; i < Math.min(idx, ANSWERS_BY_DATE.length); i++) {
    past.add(ANSWERS_BY_DATE[i]);
  }
  return past;
}

/**
 * Compute a weight multiplier for a past answer based on its use count.
 *
 * Strategy rationale (API-verified data, Feb-Mar 2026):
 * - ~11% of daily answers are reuses from ~1721 past words
 * - ~89% are new words from ~623 remaining unused candidates
 * - Per-word: each unused word is ~23x more likely than each past answer
 * - Words used twice have unknown third-use probability (no data yet)
 * - All confirmed reuses so far are from words originally used 3.9-4.7 years ago
 *
 * Returns 1.0 for never-used words, reduced values for past answers.
 */
export function pastAnswerWeight(useCount: number): number {
  if (useCount === 0) return 1.0;
  if (useCount === 1) return 0.04;
  // Used 2+ times — very unlikely to be used again but not impossible
  return 0.01;
}

/**
 * Default: keep all candidates; consumers apply pastAnswerWeight via weights.
 */
export function initialCandidates(possibleWords: readonly string[]): string[] {
  return [...possibleWords];
}
