'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Pattern } from '@/lib/wordle/feedback';
import { ShareCard } from './ShareCard';

interface AnswerZoneProps {
  candidateCount: number;
  candidates: string[];
  recommended: { guess: string; score: number } | null;
  isComputing: boolean;
  onSelectWord: (word: string) => void;
  history: Array<{ guess: string; pattern: Pattern }>;
  /** Whether the recommended guess is a probe (not a possible answer). */
  isProbe?: boolean;
  onWhyClick?: () => void;
  /** Display variant: 'standalone' renders full card chrome, 'embedded' strips border/bg for use inside a parent card. */
  variant?: 'standalone' | 'embedded';
  newLetterCount?: number;
  solveChance?: number;
  worstCase?: number;
}

export function AnswerZone({ candidateCount, candidates, recommended, isComputing, onSelectWord, history, isProbe, onWhyClick, variant = 'standalone', newLetterCount, solveChance, worstCase }: AnswerZoneProps) {
  const stateKey = candidateCount === 1 ? 'solved' :
                   candidateCount >= 2 && candidateCount <= 25 ? 'shortlist' :
                   candidateCount === 0 ? 'empty' : 'suggest';

  let content: React.ReactNode;
  let className: string;

  if (candidateCount === 1) {
    const solvedWord = candidates[0].toUpperCase();
    className = variant === 'embedded'
      ? "p-6 border-l-2 border-emerald-500/60"
      : "rounded-xl border-2 border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-500/60 dark:bg-emerald-950/30 solved-glow";
    content = (
      <>
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Solved!
        </motion.div>
        <div className="mt-1 flex gap-1">
          {solvedWord.split('').map((letter, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{
                delay: 0.15 + i * 0.08,
                type: 'spring',
                stiffness: 500,
                damping: 15,
              }}
              className="font-mono text-4xl font-bold text-emerald-800 tracking-widest dark:text-emerald-300"
            >
              {letter}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <ShareCard history={history} answer={candidates[0]} />
        </motion.div>
      </>
    );
  } else if (candidateCount >= 2 && candidateCount <= 25) {
    className = variant === 'embedded'
      ? "p-6"
      : "rounded-xl border border-zinc-800 bg-zinc-950 p-6";
    content = (
      <>
        <div className="text-sm font-medium text-zinc-400">
          {candidateCount === 2 ? '50/50 \u2014 it\u2019s one of these:' :
           candidateCount <= 5 ? `Down to ${candidateCount} \u2014 should solve next guess:` :
           `${candidateCount} possible answers:`}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.map((w, i) => (
            <motion.button
              key={w}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.15 }}
              onClick={() => onSelectWord(w)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
            >
              {w.toUpperCase()}
            </motion.button>
          ))}
        </div>
        {recommended && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
            {candidates.includes(recommended.guess) ? 'Best guess:' : 'Best info-gathering probe (not an answer):'}{' '}
            <button
              onClick={() => onSelectWord(recommended.guess)}
              className="font-mono font-semibold text-zinc-200 underline-offset-2 hover:underline"
            >
              {recommended.guess.toUpperCase()}
            </button>
          </div>
        )}
        {recommended && onWhyClick && (
          <button
            onClick={onWhyClick}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
          >
            {candidateCount <= 3 && candidates.length >= 2
              ? `Why not ${candidates.find(c => c !== recommended.guess)?.toUpperCase()}?`
              : 'Why this guess?'}
          </button>
        )}
      </>
    );
  } else if (candidateCount === 0) {
    className = variant === 'embedded'
      ? "p-6"
      : "rounded-xl border border-red-900/50 bg-red-950/20 p-6";
    content = (
      <>
        <div className="text-sm font-medium text-red-400">No possible answers remain</div>
        <div className="mt-1 text-xs text-red-400/70">Double-check your feedback tiles, or reset and try again.</div>
      </>
    );
  } else {
    className = variant === 'embedded'
      ? "p-6"
      : "rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6";
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
        {isProbe && (
          <div className="mt-1 text-[11px] text-zinc-500">info probe — not a possible answer</div>
        )}
        {/* Inline reasoning pills */}
        {(newLetterCount != null || solveChance != null || worstCase != null) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {newLetterCount != null && newLetterCount > 0 && (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
                {newLetterCount} new letter{newLetterCount !== 1 ? 's' : ''}
              </span>
            )}
            {solveChance != null && solveChance > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                {Math.round(solveChance * 100)}% solve chance
              </span>
            )}
            {worstCase != null && (
              <span className="rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                worst case {worstCase} left
              </span>
            )}
          </div>
        )}
        {recommended && onWhyClick && !isComputing && (
          <button
            onClick={onWhyClick}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
          >
            Why this guess?
          </button>
        )}
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
