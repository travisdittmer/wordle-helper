'use client';

import { useEffect } from 'react';

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
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
          <h2 className="text-lg font-semibold">How it works</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <div>
            <span className="font-medium">Getting started</span>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              Type your guess (or use the solver&rsquo;s suggestion), tap the tiles to match
              the colors Wordle showed you, then hit Apply. Repeat until solved.
            </p>
          </div>

          <div>
            <span className="font-medium">Probes</span>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              Sometimes the best move isn&rsquo;t a possible answer &mdash; it&rsquo;s a word
              that eliminates the most options. These are labeled &ldquo;probe&rdquo; so you
              know the solver is gathering information, not guessing.
            </p>
          </div>

          <div>
            <span className="font-medium">Scores</span>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              Each guess is scored in bits of information. A score of 5.0 narrows the
              remaining answers by ~32&times;. Higher is better &mdash; like playing
              20 Questions optimally.
            </p>
          </div>

          <div>
            <span className="font-medium">Under the hood</span>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              The solver evaluates every allowed guess for how well it splits the remaining
              answers, then looks two steps ahead to find the move that gets you to the
              answer fastest. Past answers are downweighted since NYT is unlikely to repeat
              them soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
