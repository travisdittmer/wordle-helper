export interface WeightConfig {
  name: string;
  pastAnswer: {
    usedOnce: number;
    usedTwice: number;
  };
  frequencyWeightRange: [number, number];
  seasonalBoostEnabled: boolean;
}

export interface GameResult {
  gameIndex: number;
  answer: string;
  guesses: string[];
  guessCount: number;
  solved: boolean;
  pastAnswersKnown: number;
  answerWasPastReuse: boolean;
}

export interface BenchmarkSummary {
  totalGames: number;
  solved: number;
  failed: number;
  solveRate: number;
  averageGuesses: number;
  medianGuesses: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number; fail: number };
  byEra: {
    preReuse: { games: number; averageGuesses: number; solveRate: number };
    reuse: { games: number; averageGuesses: number; solveRate: number };
  };
  byAnswerType: {
    newWord: { games: number; averageGuesses: number; solveRate: number };
    reusedAnswer: { games: number; averageGuesses: number; solveRate: number };
  };
}

export interface BenchmarkResult {
  timestamp: string;
  gitCommit: string;
  config: WeightConfig;
  summary: BenchmarkSummary;
  games: GameResult[];
  durationMs: number;
  quick: boolean;
}
