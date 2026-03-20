'use client';

import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'wordle-helper:onboarded';

export function OnboardingOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        const timer = setTimeout(() => setShow(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-sm">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Type your guess, tap tiles to match colors, then Apply.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              We suggest the best word — just set the tile colors Wordle gave you.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
