# Wordle Helper

Solve Wordle faster. Get the best guess instantly, every day.

A mobile-first Wordle solver that uses entropy maximization to recommend the best guess at each step. Built with Next.js, installable as a PWA. Live at [wordle.arco42.com](https://wordle.arco42.com).

## How it works

1. **Enter your guess** -- type the word you guessed in Wordle, or use the solver's suggestion
2. **Match the colors** -- tap each tile to cycle through gray, yellow, and green to match Wordle's feedback
3. **Get your next guess** -- hit Apply and the solver narrows down possibilities and suggests the best next word

The solver picks guesses that maximize information entropy -- each guess is chosen to split the remaining possibilities as evenly as possible, weighted by how likely each word is to be the answer. Words that haven't been used yet count fully; past answers count much less, since NYT only occasionally reuses them. Once the curated answer list narrows to 20 words or fewer, the solver also considers rarer valid words at a small weight, because NYT sometimes picks answers from outside that list. In the mid-game (51-200 candidates) it looks two steps ahead.

It also knows how many guesses you have left. With two left, it picks the guess that gives you the best chance of winning by the sixth; on your last guess, it goes with the most likely answer.

## Features

- Entropy-based solver with two-step lookahead and last-guess strategy
- Adaptive Answer Zone -- shows the suggestion, a shortlist ranked by estimated chance, "only one word fits", or the solved / out-of-guesses result
- "Why this guess?" analysis drawer -- pattern outcomes and letter coverage, plus a comparison for any guess you type
- First-time onboarding walkthrough
- Visual keyboard tracking letter states
- Guess history with colored tiles, undo, and start over
- Top-N guess explorer for power users
- Post-solve shareable emoji grid and a one-line reward sentence
- **Answer history** (`/history`) -- every past Wordle answer with annotations for reused words and rare picks (answers NYT chose from outside the curated answer list)
- Light mode by default, with a dark mode toggle
- Installable as a PWA
- Solver runs client-side in a Web Worker

## Development

```bash
npm install
npm run dev              # start dev server on port 3000
npm run build            # production build
npm run lint             # ESLint
npm run test             # run all tests
npm run benchmark:quick  # replay every past game with the solver (~20 min; `npm run benchmark` for the full ~2-3 hour run)
```

## Wordlist maintenance

`src/data/possible_words.txt` is the frozen curated answer list (NYT's 2,309-word version of the original Wordle answers). It isn't edited by scripts. `npm run sync:wordlists` regenerates `src/lib/wordlists.ts` from the source files, adding every confirmed answer that isn't in the curated list and marking it as a rare pick.

Fetch confirmed answers from the NYT API:

```bash
npm run fetch:answers
npm run sync:wordlists
```

To add an answer before the fetch picks it up, add it to `src/data/answer_overrides.txt` and rerun `npm run sync:wordlists`.

Refresh the full list of valid guesses from NYT's Wordle bundle:

```bash
npm run fetch:allowed
npm run sync:wordlists
```

GitHub Actions keep the data current: answers are fetched daily (scheduled for 5:30 AM UTC), and the valid-guess list is refreshed on the 1st and 15th of each month. Both auto-commit their changes.

## Tech stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- framer-motion
- TypeScript
