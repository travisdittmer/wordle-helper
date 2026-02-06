/**
 * Historical Wordle answers ("word of the day") support.
 *
 * Policy option A (Travis): exclude any known past answer words from the candidate set.
 *
 * NOTE: This only works as well as the history dataset you provide.
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

export function knownPastAnswers(now = new Date()): Set<string> {
  const idx = currentWordleIndexUtc(now);
  const past = new Set<string>();
  for (let i = 0; i < Math.min(idx, ANSWERS_BY_DATE.length); i++) {
    past.add(ANSWERS_BY_DATE[i]);
  }
  return past;
}

/**
 * Default: do NOT exclude. Keep all candidates; consumers may downweight past answers.
 */
export function initialCandidates(possibleWords: readonly string[]): string[] {
  return [...possibleWords];
}
