'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface AnswerZoneProps {
  candidateCount: number;
  candidates: string[];
  recommended: { guess: string; score: number } | null;
  isComputing: boolean;
  onSelectWord: (word: string) => void;
}

export function AnswerZone({ candidateCount, candidates, recommended, isComputing, onSelectWord }: AnswerZoneProps) {
  const stateKey = candidateCount === 1 ? 'solved' :
                   candidateCount >= 2 && candidateCount <= 25 ? 'shortlist' :
                   candidateCount === 0 ? 'empty' : 'suggest';

  let content: React.ReactNode;
  let className: string;

  if (candidateCount === 1) {
    className = "rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-6";
    content = (
      <>
        <div className="text-sm font-medium text-emerald-400">Solved!</div>
        <div className="mt-1 font-mono text-4xl font-bold text-emerald-300 tracking-widest">
          {candidates[0].toUpperCase()}
        </div>
      </>
    );
  } else if (candidateCount >= 2 && candidateCount <= 25) {
    className = "rounded-xl border border-zinc-800 bg-zinc-950 p-6";
    content = (
      <>
        <div className="text-sm font-medium text-zinc-400">
          {candidateCount === 2 ? '50/50 \u2014 it\u2019s one of these:' :
           candidateCount <= 5 ? `Down to ${candidateCount} \u2014 should solve next guess:` :
           `${candidateCount} possible answers:`}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.map((w) => (
            <button
              key={w}
              onClick={() => onSelectWord(w)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
            >
              {w.toUpperCase()}
            </button>
          ))}
        </div>
        {recommended && (
          <div className="mt-3 text-xs text-zinc-500">
            Best strategic guess:{' '}
            <button
              onClick={() => onSelectWord(recommended.guess)}
              className="font-mono text-zinc-300 underline-offset-2 hover:underline"
            >
              {recommended.guess.toUpperCase()}
            </button>
          </div>
        )}
      </>
    );
  } else if (candidateCount === 0) {
    className = "rounded-xl border border-red-900/50 bg-red-950/20 p-6";
    content = (
      <>
        <div className="text-sm font-medium text-red-400">No possible answers remain</div>
        <div className="mt-1 text-xs text-red-400/70">Double-check your feedback tiles, or reset and try again.</div>
      </>
    );
  } else {
    className = "rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6";
    content = isComputing ? (
      <div>
        <div className="text-sm font-medium text-zinc-400">Finding best guess...</div>
        <div className="mt-2 h-8 w-32 animate-pulse rounded bg-zinc-800" />
      </div>
    ) : recommended ? (
      <div>
        <div className="text-sm font-medium text-zinc-400">
          {candidateCount > 50 ? 'Try this word next' : `${candidateCount} left \u2014 try this next`}
        </div>
        <div className="mt-1 font-mono text-4xl font-bold tracking-widest text-white">
          {recommended.guess.toUpperCase()}
        </div>
      </div>
    ) : (
      <div className="text-sm text-zinc-500">Enter your first guess below</div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={stateKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {content}
      </motion.section>
    </AnimatePresence>
  );
}
