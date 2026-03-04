/**
 * Seasonal / thematic word boosting.
 *
 * Wordle editors occasionally pick words that relate to current events,
 * holidays, or seasons. This module applies a small boost to thematically
 * relevant words based on the current date.
 */

type SeasonalRule = {
  /** Month (1-12) when this rule is active. */
  month: number;
  /** Optional: only active on these days of the month (inclusive). */
  days?: [number, number];
  /** Words to boost during this period. */
  words: string[];
  /** Boost multiplier (e.g., 1.5 = 50% more likely). */
  boost: number;
};

const SEASONAL_RULES: SeasonalRule[] = [
  // Winter / Christmas / New Year (December)
  {
    month: 12,
    words: [
      'holly', 'frost', 'snowy', 'angel', 'carol', 'feast', 'merry',
      'jolly', 'candy', 'light', 'sleek', 'chill', 'snowy', 'peace',
      'north', 'santa', 'cedar', 'ivory', 'night', 'sweet', 'sugar',
      'stove', 'scarf', 'toast', 'bliss', 'cheer', 'grace', 'shine',
    ],
    boost: 1.4,
  },
  // New Year (January early)
  {
    month: 1,
    days: [1, 10],
    words: [
      'begin', 'fresh', 'start', 'first', 'renew', 'spark', 'dream',
      'toast', 'party', 'cheek', 'bliss', 'cheer',
    ],
    boost: 1.3,
  },
  // Valentine's Day (February)
  {
    month: 2,
    days: [7, 18],
    words: [
      'heart', 'sweet', 'lover', 'candy', 'blush', 'charm', 'adore',
      'flame', 'crush', 'dance', 'rouge', 'roses',
    ],
    boost: 1.3,
  },
  // Spring (March-April)
  {
    month: 3,
    words: [
      'bloom', 'green', 'fresh', 'plant', 'earth', 'rainy', 'daisy',
      'grass', 'flora', 'robin', 'creek', 'sunny', 'trail',
    ],
    boost: 1.2,
  },
  {
    month: 4,
    words: [
      'bloom', 'green', 'fresh', 'plant', 'earth', 'rainy', 'daisy',
      'bunny', 'grass', 'flora', 'robin', 'tulip', 'creek', 'sunny',
    ],
    boost: 1.2,
  },
  // Mother's Day (May early-mid)
  {
    month: 5,
    days: [5, 15],
    words: [
      'mommy', 'heart', 'grace', 'bloom', 'flora', 'sweet', 'pearl',
    ],
    boost: 1.2,
  },
  // Summer (June-August)
  {
    month: 6,
    words: [
      'beach', 'sunny', 'ocean', 'water', 'float', 'shore', 'yacht',
      'coral', 'sandy', 'sauna', 'flame', 'sweat', 'flare',
    ],
    boost: 1.15,
  },
  {
    month: 7,
    words: [
      'beach', 'sunny', 'ocean', 'water', 'float', 'shore', 'spark',
      'flame', 'light', 'pride', 'eagle', 'grand', 'party', 'blaze',
    ],
    boost: 1.15,
  },
  {
    month: 8,
    words: [
      'beach', 'sunny', 'ocean', 'water', 'float', 'shore', 'coral',
      'sandy', 'sweat',
    ],
    boost: 1.15,
  },
  // Fall / Halloween (October)
  {
    month: 10,
    words: [
      'ghost', 'scary', 'trick', 'witch', 'haunt', 'creep', 'skull',
      'candy', 'night', 'flame', 'crypt', 'foggy', 'eerie', 'ghoul',
      'spine', 'fright',
    ],
    boost: 1.3,
  },
  // Thanksgiving (November mid-late)
  {
    month: 11,
    days: [15, 30],
    words: [
      'feast', 'gravy', 'toast', 'thank', 'table', 'cider', 'bread',
      'sweet', 'pecan', 'crowd', 'roast', 'flour', 'stove',
    ],
    boost: 1.3,
  },
  // Autumn general (September-November)
  {
    month: 9,
    words: [
      'maple', 'brown', 'cedar', 'amber', 'crisp', 'cider', 'foggy',
      'trail', 'shawl', 'stove',
    ],
    boost: 1.15,
  },
  {
    month: 10,
    words: [
      'maple', 'brown', 'cedar', 'amber', 'crisp', 'cider',
    ],
    boost: 1.1,
  },
  {
    month: 11,
    words: [
      'maple', 'brown', 'cedar', 'amber', 'crisp', 'cider', 'foggy',
    ],
    boost: 1.1,
  },
];

/**
 * Compute seasonal boost multipliers for a list of candidates.
 * Returns an array of multipliers (>=1.0) for each candidate.
 */
export function seasonalBoosts(candidates: readonly string[], now = new Date()): number[] {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Collect all active boosts into a word -> max boost map.
  const boostMap = new Map<string, number>();

  for (const rule of SEASONAL_RULES) {
    if (rule.month !== month) continue;
    if (rule.days && (day < rule.days[0] || day > rule.days[1])) continue;

    for (const word of rule.words) {
      const existing = boostMap.get(word) ?? 1;
      // Stack multiplicatively but cap at a reasonable max.
      boostMap.set(word, Math.min(existing * rule.boost, 2.0));
    }
  }

  return candidates.map((w) => boostMap.get(w.toLowerCase()) ?? 1.0);
}
