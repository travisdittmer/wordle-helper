export type Tile = 'B' | 'Y' | 'G';
export type Pattern = `${Tile}${Tile}${Tile}${Tile}${Tile}`;

/**
 * Compute the Wordle feedback pattern for (guess, answer).
 * Implements official rules for repeated letters:
 * 1) Mark greens.
 * 2) For remaining letters in guess, mark yellow only if the letter exists in remaining (unmatched) answer letters.
 */
export function feedbackPattern(guessRaw: string, answerRaw: string): Pattern {
  const guess = guessRaw.toLowerCase();
  const answer = answerRaw.toLowerCase();
  if (guess.length !== 5 || answer.length !== 5) throw new Error('guess/answer must be length 5');

  const res: Tile[] = ['B', 'B', 'B', 'B', 'B'];
  const remaining: Record<string, number> = {};

  // Greens first
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'G';
    } else {
      const ch = answer[i];
      remaining[ch] = (remaining[ch] ?? 0) + 1;
    }
  }

  // Yellows second
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'G') continue;
    const ch = guess[i];
    const n = remaining[ch] ?? 0;
    if (n > 0) {
      res[i] = 'Y';
      remaining[ch] = n - 1;
    }
  }

  return res.join('') as Pattern;
}

export function isValidPattern(p: string): p is Pattern {
  return /^[BYG]{5}$/.test(p);
}
