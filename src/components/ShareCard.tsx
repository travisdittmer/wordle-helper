'use client';

import { useState } from 'react';
import type { Pattern, Tile } from '@/lib/wordle/feedback';

interface ShareCardProps {
  history: Array<{ guess: string; pattern: Pattern }>;
  answer: string;
}

function patternToEmoji(pattern: Pattern): string {
  return pattern.split('').map((t) => {
    switch (t as Tile) {
      case 'G': return '\u{1F7E9}';
      case 'Y': return '\u{1F7E8}';
      default: return '\u{2B1B}';
    }
  }).join('');
}

export function ShareCard({ history, answer }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  // If the answer was deduced (narrowed to 1 candidate) rather than directly guessed,
  // the final guess isn't in history yet — account for it in count and emoji grid.
  const lastIsAnswer = history.length > 0 && history[history.length - 1].guess === answer;
  const guessCount = lastIsAnswer ? history.length : history.length + 1;
  const lines = history.map((h) => patternToEmoji(h.pattern));
  if (!lastIsAnswer) lines.push(patternToEmoji('GGGGG' as Pattern));
  const shareText = `Wordle Helper \u2192 Solved in ${guessCount}\n\n${lines.join('\n')}\n\nwordle.arco42.com`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={onCopy}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
      >
        {copied ? 'Copied!' : `Share result (${guessCount} guesses)`}
      </button>
    </div>
  );
}
