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

  const guessCount = history.length;
  const lines = history.map((h) => patternToEmoji(h.pattern));
  const shareText = `Wordle Helper \u2192 Solved in ${guessCount}\n\n${lines.join('\n')}\n\nwordlehelper.app`;

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
