import { feedbackPattern } from '../src/lib/wordle/feedback';
import { filterCandidatesByFeedback } from '../src/lib/wordle/solver';
import { bestNextGuessHeuristic } from '../src/lib/wordle/solver_fast';
import { frequencyWeights } from '../src/lib/wordle/wordFrequency';
import { seasonalBoosts } from '../src/lib/wordle/seasonalBoost';
import type { WeightConfig, GameResult } from './benchmark-types';

const MAX_GUESSES = 6;

export function computeWeights(
  candidates: readonly string[],
  pastCounts: Map<string, number>,
  config: WeightConfig,
): number[] {
  const freqW = frequencyWeights(candidates);
  const seasonal = config.seasonalBoostEnabled ? seasonalBoosts(candidates) : candidates.map(() => 1);
  const [minFreq, maxFreq] = config.frequencyWeightRange;

  return candidates.map((word, i) => {
    const useCount = pastCounts.get(word) ?? 0;
    let pastFactor: number;
    if (useCount === 0) pastFactor = 1.0;
    else if (useCount === 1) pastFactor = config.pastAnswer.usedOnce;
    else pastFactor = config.pastAnswer.usedTwice;

    // Remap frequency weight to config range
    const rawFreq = freqW[i];
    const normalizedFreq = (rawFreq - 0.2) / 0.8; // 0..1
    const freq = minFreq + normalizedFreq * (maxFreq - minFreq);

    return pastFactor * freq * seasonal[i];
  });
}

export function playGame(opts: {
  answer: string;
  gameIndex: number;
  pastCounts: Map<string, number>;
  allCandidates: readonly string[];
  allowedGuesses: readonly string[];
  config: WeightConfig;
  quick?: boolean;
}): GameResult {
  const { answer, gameIndex, pastCounts, allCandidates, allowedGuesses, config, quick } = opts;

  let candidates = [...allCandidates];
  const guesses: string[] = [];
  const answerWasPastReuse = (pastCounts.get(answer) ?? 0) > 0;

  for (let round = 1; round <= MAX_GUESSES; round++) {
    const weights = computeWeights(candidates, pastCounts, config);
    const { guess } = bestNextGuessHeuristic({
      candidates,
      weights,
      allowedGuesses,
      finishThreshold: 50,
      shortlistSize: quick ? 500 : 2500,
      lookaheadThreshold: quick ? 0 : 200,
    });

    guesses.push(guess);

    if (guess === answer) {
      return {
        gameIndex,
        answer,
        guesses,
        guessCount: round,
        solved: true,
        pastAnswersKnown: pastCounts.size,
        answerWasPastReuse,
      };
    }

    const pattern = feedbackPattern(guess, answer);
    candidates = filterCandidatesByFeedback({ candidates, guess, pattern });

    if (candidates.length === 0) break;
  }

  return {
    gameIndex,
    answer,
    guesses,
    guessCount: MAX_GUESSES,
    solved: false,
    pastAnswersKnown: pastCounts.size,
    answerWasPastReuse,
  };
}
