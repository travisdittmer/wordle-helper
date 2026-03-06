# Wordle Helper

Solve Wordle faster. Get the best guess instantly, every day.

A mobile-first Wordle solver that uses entropy maximization to recommend the optimal guess at each step. Built with Next.js, installable as a PWA.

## How it works

1. **Enter your guess** -- type the word you guessed in Wordle, or use the solver's suggestion
2. **Match the colors** -- tap each tile to cycle through gray, yellow, and green to match Wordle's feedback
3. **Get your next guess** -- hit Apply and the solver narrows down possibilities and suggests the best next word

The solver picks guesses that maximize information entropy -- each guess is chosen to eliminate the most possibilities regardless of what colors come back. When fewer than 200 candidates remain, it looks two steps ahead. It also factors in word commonality and avoids reusing past Wordle answers.

## Features

- Entropy-based solver with two-step lookahead
- Adaptive Answer Zone -- shows suggestion, narrowed shortlist, or solved state at the top of the page
- First-time onboarding walkthrough
- Visual keyboard tracking letter states
- Guess history with colored tiles
- Top-N guess explorer for power users
- Post-solve shareable emoji grid
- Dark mode by default (matches Wordle's aesthetic)
- Installable as a PWA
- Runs entirely client-side via Web Worker

## Development

```bash
npm install
npm run dev       # start dev server on port 3000
npm run build     # production build
npm run lint      # ESLint
npm run test      # run all tests
```

## Wordlist maintenance

Refresh generated wordlists and keep `possible_words` in sync with known answers/overrides:

```bash
npm run sync:wordlists
```

If NYT introduces answers not present in the legacy list, add them to `src/data/answer_overrides.txt` then rerun `npm run sync:wordlists`.

Fetch confirmed answers from the NYT API:

```bash
npm run fetch:answers
```

A daily GitHub Action runs both scripts at 5:30 AM UTC and auto-commits new answers.

## Tech stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- framer-motion
- TypeScript
