'use client';

import { useEffect } from 'react';

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 px-4 py-12" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">How does this work?</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            This app helps you solve the daily Wordle by recommending the best guess at each step.
            You play Wordle normally — type the suggested word into Wordle, then tap the tiles here
            to match the colors Wordle gave you (gray, yellow, or green). Hit <strong>Apply feedback</strong> and
            the app narrows down the remaining possibilities and suggests your next guess.
          </p>
          <p>
            <strong>How it picks guesses:</strong> The solver uses <em>entropy maximization</em> — it
            picks the guess that, on average, eliminates the most possibilities regardless of what
            colors come back. Think of it like playing 20 Questions optimally.
          </p>
          <p>
            <strong>Probes vs. candidates:</strong> Sometimes the best strategic guess isn&rsquo;t
            a word that could be the answer &mdash; it&rsquo;s a <em>probe</em> that eliminates
            the most possibilities. For example, if the answer is either WATCH or MATCH, guessing
            WIMPY (a probe) would tell you which one instantly. The app labels probes so you
            know whether your guess could also solve the puzzle.
          </p>
          <p>
            <strong>Extra smarts:</strong> When under 200 candidates remain, the solver looks two
            steps ahead. It also factors in word commonality and past Wordle answer history.
          </p>
          <p>
            <strong>The score number</strong> is measured in bits of information. A score of 5.0
            means the guess narrows things down by ~32x (2&#x2075;). Higher is better.
          </p>
        </div>
      </div>
    </div>
  );
}
