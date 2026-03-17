import { feedbackPattern, type Pattern } from './feedback';

export interface Partition {
  pattern: Pattern;
  candidates: string[];
  totalWeight: number;
}

export interface GuessAnalysis {
  partitions: Partition[];
  solveChance: number;
  expectedRemaining: number;
  worstCase: number;
}

export function analyzeGuess(
  guess: string,
  candidates: readonly string[],
  weights: readonly number[],
): GuessAnalysis {
  const buckets = new Map<Pattern, { candidates: string[]; totalWeight: number }>();
  let totalWeight = 0;

  for (let i = 0; i < candidates.length; i++) {
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    totalWeight += w;
    const p = feedbackPattern(guess, candidates[i]);
    const bucket = buckets.get(p);
    if (bucket) {
      bucket.candidates.push(candidates[i]);
      bucket.totalWeight += w;
    } else {
      buckets.set(p, { candidates: [candidates[i]], totalWeight: w });
    }
  }

  const partitions: Partition[] = Array.from(buckets.entries())
    .map(([pattern, bucket]) => ({ pattern, ...bucket }))
    .sort((a, b) => b.totalWeight - a.totalWeight);

  const solveBucket = buckets.get('GGGGG' as Pattern);
  const solveChance = totalWeight > 0 && solveBucket ? solveBucket.totalWeight / totalWeight : 0;

  let expectedRemaining = 0;
  let worstCase = 0;
  let nonSolveWeight = 0;
  for (const p of partitions) {
    if (p.pattern === 'GGGGG') continue;
    nonSolveWeight += p.totalWeight;
    worstCase = Math.max(worstCase, p.candidates.length);
  }
  for (const p of partitions) {
    if (p.pattern === 'GGGGG') continue;
    const prob = nonSolveWeight > 0 ? p.totalWeight / nonSolveWeight : 0;
    expectedRemaining += prob * p.candidates.length;
  }

  return { partitions, solveChance, expectedRemaining, worstCase };
}

export type LetterStatus = 'correct' | 'present' | 'absent';

export interface LetterCoverageResult {
  newLetters: string[];
  retested: Map<string, LetterStatus>;
  positionsProbed: boolean[];
}

export function letterCoverage(
  guess: string,
  history: readonly { guess: string; pattern: Pattern }[],
): LetterCoverageResult {
  const knownLetters = new Map<string, LetterStatus>();
  const knownGreens = new Set<number>();

  for (const { guess: g, pattern } of history) {
    for (let i = 0; i < 5; i++) {
      const letter = g[i];
      const tile = pattern[i];
      if (tile === 'G') {
        knownLetters.set(letter, 'correct');
        knownGreens.add(i);
      } else if (tile === 'Y' && knownLetters.get(letter) !== 'correct') {
        knownLetters.set(letter, 'present');
      } else if (tile === 'B' && !knownLetters.has(letter)) {
        knownLetters.set(letter, 'absent');
      }
    }
  }

  const newLetters: string[] = [];
  const retested = new Map<string, LetterStatus>();
  const positionsProbed: boolean[] = [];

  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    const known = knownLetters.get(letter);
    if (known) {
      retested.set(letter, known);
      positionsProbed.push(!knownGreens.has(i));
    } else {
      newLetters.push(letter);
      positionsProbed.push(true);
    }
  }

  return { newLetters, retested, positionsProbed };
}
