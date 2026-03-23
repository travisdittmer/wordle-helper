'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ANSWERS_BY_DATE } from '@/lib/wordle/answersByDate';
import { NON_CANONICAL_ANSWERS } from '@/lib/wordlists';
import { SupportPopover } from '@/components/SupportPopover';
import { ThemeToggle } from '@/components/ThemeToggle';

const ORIGIN = new Date(Date.UTC(2021, 5, 19));

function puzzleDate(index: number): Date {
  return new Date(ORIGIN.getTime() + index * 24 * 60 * 60 * 1000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface AnswerEntry {
  index: number;
  word: string;
  date: Date;
  reuse: boolean;
  firstUsedIndex: number | null;
  rarePick: boolean;
}

function buildEntries(): AnswerEntry[] {
  const firstSeen = new Map<string, number>();
  const entries: AnswerEntry[] = [];

  for (let i = 0; i < ANSWERS_BY_DATE.length; i++) {
    const word = ANSWERS_BY_DATE[i];
    const prior = firstSeen.get(word);
    const reuse = prior !== undefined;

    entries.push({
      index: i,
      word,
      date: puzzleDate(i),
      reuse,
      firstUsedIndex: reuse ? prior : null,
      rarePick: NON_CANONICAL_ANSWERS.has(word),
    });

    if (!reuse) {
      firstSeen.set(word, i);
    }
  }

  return entries;
}

type Filter = 'all' | 'reused' | 'rare';

interface HistoryStats {
  reusedCount: number;
  rarePickCount: number;
  firstReuse: AnswerEntry | null;
  firstRarePick: AnswerEntry | null;
  reusePct: string;
  rarePickPct: string;
}

function computeStats(entries: AnswerEntry[]): HistoryStats {
  const reused = entries.filter((e) => e.reuse);
  const rarePicks = entries.filter((e) => e.rarePick);
  const firstReuse = reused[0] ?? null;
  const firstRarePick = rarePicks[0] ?? null;

  // Compute rates since first occurrence
  const reusePct = firstReuse
    ? ((reused.length / (entries.length - firstReuse.index)) * 100).toFixed(0)
    : '0';
  const rarePickPct = firstRarePick
    ? ((rarePicks.length / (entries.length - firstRarePick.index)) * 100).toFixed(0)
    : '0';

  return {
    reusedCount: reused.length,
    rarePickCount: rarePicks.length,
    firstReuse,
    firstRarePick,
    reusePct,
    rarePickPct,
  };
}

function HistoryInfoModal({ onClose, stats }: { onClose: () => void; stats: HistoryStats }) {
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
          <h2 className="text-lg font-semibold">About this page</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            Every Wordle answer since the very first puzzle, verified against the NYT API.
            Two annotations flag the interesting ones:
          </p>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                reused
              </span>
              <span className="font-medium">Reused answers</span>
            </div>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              Wordle draws from a curated pool of ~2,300 common words. After working through most
              of that pool, NYT began recycling past answers &mdash; picking words that had already
              appeared years earlier. The badge shows which puzzle it originally came from.
            </p>
            {stats.firstReuse && (
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                The first reuse was <strong>{ANSWERS_BY_DATE[stats.firstReuse.index].toUpperCase()}</strong> on {formatDate(stats.firstReuse.date)}, after {stats.firstReuse.index.toLocaleString()} puzzles without a single repeat.
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                rare pick
              </span>
              <span className="font-medium">Rare picks</span>
            </div>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              Beyond the curated answer pool, Wordle accepts ~13,000 words as valid guesses
              &mdash; obscure words you can type but wouldn&rsquo;t expect as an answer.
              A <em>rare pick</em> is when NYT chose an answer from this broader set instead,
              a word that no solver had in its candidate list.
            </p>
            {stats.firstRarePick && (
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                The first rare pick was <strong>{stats.firstRarePick.word.toUpperCase()}</strong> on {formatDate(stats.firstRarePick.date)}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const entries = useMemo(() => buildEntries(), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showInfo, setShowInfo] = useState(false);

  const filtered = useMemo(() => {
    let list = entries;
    if (filter === 'reused') list = list.filter((e) => e.reuse);
    if (filter === 'rare') list = list.filter((e) => e.rarePick);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.word.includes(q) ||
          String(e.index).includes(q) ||
          formatDate(e.date).toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, search, filter]);

  const reversed = useMemo(() => [...filtered].reverse(), [filtered]);

  const [visibleCount, setVisibleCount] = useState(100);

  const visibleEntries = useMemo(() => reversed.slice(0, visibleCount), [reversed, visibleCount]);

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; entries: typeof reversed }> = [];
    let currentLabel = '';
    let currentEntries: typeof reversed = [];

    for (const entry of visibleEntries) {
      const label = entry.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
      if (label !== currentLabel) {
        if (currentEntries.length > 0) {
          groups.push({ label: currentLabel, entries: currentEntries });
        }
        currentLabel = label;
        currentEntries = [entry];
      } else {
        currentEntries.push(entry);
      }
    }
    if (currentEntries.length > 0) {
      groups.push({ label: currentLabel, entries: currentEntries });
    }
    return groups;
  }, [visibleEntries]);

  const stats = useMemo(() => computeStats(entries), [entries]);

  return (
    <div className="relative z-10 min-h-screen text-zinc-900 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        {showInfo && <HistoryInfoModal onClose={() => setShowInfo(false)} stats={stats} />}

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Answer History</h1>
            <button
              onClick={() => setShowInfo(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="About this page"
              title="About this page"
            >
              i
            </button>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SupportPopover />
            <Link
              href="/"
              className="text-sm text-zinc-500 underline-offset-2 hover:underline hover:text-zinc-300"
            >
              Solver
            </Link>
          </div>
        </header>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          <span>{entries.length} puzzles</span>
          <span className="text-zinc-700 dark:text-zinc-600">&middot;</span>
          <span>
            {stats.reusedCount} reused
            {stats.firstReuse && <span className="text-zinc-600 dark:text-zinc-500"> ({stats.reusePct}% since onset)</span>}
          </span>
          <span className="text-zinc-700 dark:text-zinc-600">&middot;</span>
          <span>
            {stats.rarePickCount} rare pick{stats.rarePickCount !== 1 ? 's' : ''}
            {stats.firstRarePick && stats.rarePickCount > 0 && <span className="text-zinc-600 dark:text-zinc-500"> ({stats.rarePickPct}% since onset)</span>}
          </span>
        </div>

        {/* Sticky search + filter */}
        <div className="sticky top-0 z-10 -mx-4 bg-zinc-50/95 px-4 pb-3 pt-2 backdrop-blur-sm dark:bg-black/95">
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(100); }}
              placeholder="Search word, #, or date..."
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500 dark:border-zinc-700 dark:placeholder:text-zinc-600"
            />
            <div className="flex gap-1">
              {(['all', 'reused', 'rare'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setVisibleCount(100); }}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    filter === f
                      ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {(search || filter !== 'all') && (
            <div className="mt-1.5 text-xs text-zinc-500">
              {reversed.length} result{reversed.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Grouped answer list */}
        <section className="rounded-xl border border-zinc-200/50 bg-white dark:border-zinc-800/50 dark:bg-zinc-950">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="sticky top-14 z-[5] bg-white/95 px-4 py-1.5 text-xs font-semibold text-zinc-500 backdrop-blur-sm dark:bg-zinc-950/95 border-b border-zinc-200/50 dark:border-zinc-800/50">
                {group.label}
              </div>
              {group.entries.map((entry) => (
                <div
                  key={entry.index}
                  className="flex items-center justify-between border-b border-zinc-200/50 px-4 py-2.5 dark:border-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-right font-mono text-xs tabular-nums text-zinc-500">
                      #{entry.index}
                    </span>
                    <span className="font-mono text-sm font-semibold tracking-widest">
                      {entry.word.toUpperCase()}
                    </span>
                    {entry.reuse && (
                      <span
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        title={`First used as #${entry.firstUsedIndex} on ${formatDate(puzzleDate(entry.firstUsedIndex!))}`}
                      >
                        reused &larr; #{entry.firstUsedIndex}
                      </span>
                    )}
                    {entry.rarePick && (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        rare pick
                      </span>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-zinc-500">{formatDate(entry.date)}</span>
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* Load more */}
        {visibleCount < reversed.length && (
          <button
            onClick={() => setVisibleCount((c) => c + 200)}
            className="mx-auto my-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Load more ({(reversed.length - visibleCount).toLocaleString()} remaining)
          </button>
        )}

        {reversed.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-500">No matches found.</div>
        )}

        <footer className="pb-6 text-xs text-zinc-500">
          Data from NYT Wordle API. Puzzle #0 = Jun 19, 2021.
        </footer>
      </main>
    </div>
  );
}
