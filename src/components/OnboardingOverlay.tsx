'use client';

import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'wordle-helper:onboarded';

const STEPS = [
  {
    title: 'Enter your guess',
    body: 'Type the word you guessed in Wordle, or use the suggestion we provide.',
  },
  {
    title: 'Match the colors',
    body: 'Tap each tile to cycle through gray, yellow, and green \u2014 match what Wordle showed you.',
  },
  {
    title: 'Get your next guess',
    body: 'Hit Apply and we\u2019ll tell you the best word to try next. Repeat until solved!',
  },
];

export function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setShow(true);
      }
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // ignore
    }
  }

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-500">{step + 1} of {STEPS.length}</div>
          <button onClick={dismiss} className="text-xs text-zinc-500 hover:text-zinc-300">skip</button>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-white">{current.title}</h3>
        <p className="mt-2 text-sm text-zinc-300">{current.body}</p>
        <button
          onClick={() => isLast ? dismiss() : setStep(step + 1)}
          className="mt-5 w-full rounded-lg bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          {isLast ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  );
}
