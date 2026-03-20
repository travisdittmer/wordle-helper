'use client';

import { useEffect } from 'react';

interface InfoModalProps {
  onClose: () => void;
}

const CARDS = [
  {
    title: 'How to use',
    icon: '1',
    body: 'Type your guess (or use ours), tap tiles to match Wordle\u2019s colors, then hit Apply. Repeat until solved.',
  },
  {
    title: 'Why probes help',
    icon: '?',
    body: 'Sometimes the best move isn\u2019t a possible answer \u2014 it\u2019s a word that eliminates the most options. We label these \u201Cinfo probes\u201D so you know.',
  },
  {
    title: 'How scores work',
    icon: '#',
    body: 'The score is measured in bits. A score of 5.0 narrows things down by ~32\u00D7. Higher is better \u2014 like playing 20 Questions optimally.',
  },
];

export function InfoModal({ onClose }: InfoModalProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/50 px-4 py-12" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">How it works</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3">
          {CARDS.map((card) => (
            <div key={card.title} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-zinc-300">
                {card.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{card.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] text-zinc-600">
          The solver uses two-step lookahead with entropy maximization and weighted priors.
        </p>
      </div>
    </div>
  );
}
