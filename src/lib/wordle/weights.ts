/**
 * Shared candidate weighting logic used by both the production solver and benchmark engine.
 *
 * Weights are the product of three factors:
 * - Past-answer weight: reduced for words already used as Wordle answers
 * - Frequency weight: commonality proxy based on bigram/unigram scoring
 * - Seasonal boost: small multiplier for thematically relevant words
 *
 * Each factor is controlled by WeightConfig. The production default disables
 * frequency and seasonal factors (benchmark showed they hurt performance).
 */

import { pastAnswerWeight } from './history';
import { frequencyWeights } from './wordFrequency';
import { seasonalBoosts } from './seasonalBoost';

export interface WeightConfig {
  name: string;
  pastAnswer: {
    usedOnce: number;
    usedTwice: number;
  };
  frequencyWeightRange: [number, number];
  seasonalBoostEnabled: boolean;
}

/**
 * Production default: past-answer weight only.
 * Benchmark showed frequency and seasonal priors hurt performance.
 */
export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  name: 'production',
  pastAnswer: {
    usedOnce: 0.04,
    usedTwice: 0.01,
  },
  frequencyWeightRange: [1.0, 1.0],
  seasonalBoostEnabled: false,
};

export function computeWeights(
  candidates: readonly string[],
  pastCounts: Map<string, number>,
  config: WeightConfig = DEFAULT_WEIGHT_CONFIG,
): number[] {
  const freqW = frequencyWeights(candidates);
  const seasonal = config.seasonalBoostEnabled ? seasonalBoosts(candidates) : candidates.map(() => 1);
  const [minFreq, maxFreq] = config.frequencyWeightRange;

  return candidates.map((word, i) => {
    const useCount = pastCounts.get(word) ?? 0;
    const pastFactor = pastAnswerWeight(useCount, config.pastAnswer);

    // Remap frequency weight to config range
    const rawFreq = freqW[i];
    // frequencyWeights() maps to [0.2, 1.0] — see wordFrequency.ts
    const normalizedFreq = (rawFreq - 0.2) / 0.8; // 0..1
    const freq = minFreq + normalizedFreq * (maxFreq - minFreq);

    return pastFactor * freq * seasonal[i];
  });
}
