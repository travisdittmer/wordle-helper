'use client';

import { useState } from 'react';
import type { Pattern } from '@/lib/wordle/feedback';
import { buildShareText } from '@/lib/wordle/game';

interface ShareCardProps {
  history: Array<{ guess: string; pattern: Pattern }>;
}

export function ShareCard({ history }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  // Only a won game (all-green last row) has a result to share.
  const shareText = buildShareText(history);
  if (!shareText) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={onCopy}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
      >
        {copied ? 'Copied!' : `Share result (${history.length} guesses)`}
      </button>
    </div>
  );
}
