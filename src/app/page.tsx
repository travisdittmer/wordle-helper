'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALLOWED_WORDS, POSSIBLE_WORDS } from '@/lib/wordlists';
import { isValidPattern, Pattern, Tile } from '@/lib/wordle/feedback';
import { initialCandidates, knownPastAnswers, todayKey } from '@/lib/wordle/history';
import { filterCandidatesByFeedback, topGuesses } from '@/lib/wordle/solver';
import type { WorkerResponse } from '@/lib/wordle/solverWorker';

const TILE_ORDER: Tile[] = ['B', 'Y', 'G'];

function nextTile(t: Tile): Tile {
  const idx = TILE_ORDER.indexOf(t);
  return TILE_ORDER[(idx + 1) % TILE_ORDER.length];
}

function tileClass(t: Tile): string {
  switch (t) {
    case 'G':
      return 'bg-emerald-600 border-emerald-700 text-white';
    case 'Y':
      return 'bg-amber-500 border-amber-600 text-white';
    case 'B':
    default:
      return 'bg-zinc-300 border-zinc-400 text-zinc-900 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-50';
  }
}

function normalizeWord(s: string): string {
  return s.trim().toLowerCase();
}

export default function Home() {
  const [candidates, setCandidates] = useState<string[]>(() => initialCandidates(POSSIBLE_WORDS));
  const [guess, setGuess] = useState<string>('');
  const [tiles, setTiles] = useState<Tile[]>(['B', 'B', 'B', 'B', 'B']);
  const [history, setHistory] = useState<Array<{ guess: string; pattern: Pattern }>>([]);
  const [showTop, setShowTop] = useState<boolean>(false);
  const [topN, setTopN] = useState<number>(10);

  const PAST_WEIGHT_KEY = 'wordle-helper:past-answer-weight:v1';

  // Slider: how likely a previously-used Wordle answer is, relative to unused answers.
  // 0 = treat past answers as impossible; 1 = no penalty.
  const [pastAnswerWeight, setPastAnswerWeight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PAST_WEIGHT_KEY);
      if (!raw) return 0.05;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0.05;
      return Math.max(0, Math.min(1, n));
    } catch {
      return 0.05;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [lastComputeMs, setLastComputeMs] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);

  const allowedGuesses = useMemo(() => Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS])), []);

  const [recommended, setRecommended] = useState<{ guess: string; score: number } | null>(null);

  const FIRST_GUESS_CACHE_KEY = `wordle-helper:first-guess:v1:${todayKey()}`;

  function computeRecommended(nextCandidates: string[]) {
    const w = workerRef.current;
    if (!w) return;
    setIsComputing(true);
    setLastComputeMs(null);
    w.postMessage({ type: 'compute', candidates: nextCandidates, pastAnswerWeight });
  }

  function loadCachedFirstGuess(): { guess: string; score?: number } | null {
    try {
      const raw = localStorage.getItem(FIRST_GUESS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.guess !== 'string') return null;
      const g = normalizeWord(parsed.guess);
      if (g.length !== 5) return null;
      return { guess: g, score: typeof parsed.score === 'number' ? parsed.score : undefined };
    } catch {
      return null;
    }
  }

  function saveCachedFirstGuess(x: { guess: string; score: number }) {
    try {
      localStorage.setItem(FIRST_GUESS_CACHE_KEY, JSON.stringify({ guess: x.guess, score: x.score, savedAt: Date.now() }));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Create worker once
    if (workerRef.current) return;
    const w = new Worker(new URL('../lib/wordle/solverWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;

    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === 'result') {
        setRecommended({ guess: msg.guess, score: msg.score });
        setGuess(msg.guess);
        setTiles(['B', 'B', 'B', 'B', 'B']);
        setIsComputing(false);
        setLastComputeMs(msg.tookMs);

        // Cache the first-guess result (only when we're at the initial candidate set for today).
        if (candidates.length === initialCandidates(POSSIBLE_WORDS).length) {
          saveCachedFirstGuess({ guess: msg.guess, score: msg.score });
        }
      }
    };

    // Load cached first guess immediately (instant UI), then compute in background to refresh.
    const cached = loadCachedFirstGuess();
    if (cached) {
      // Defer state updates to satisfy react-hooks/set-state-in-effect lint rule
      setTimeout(() => {
        setRecommended(cached.score != null ? { guess: cached.guess, score: cached.score } : null);
        setGuess(cached.guess);
        setTiles(['B', 'B', 'B', 'B', 'B']);
      }, 0);
    }

    // initial compute (defer to avoid setState-in-effect lint rule)
    setTimeout(() => computeRecommended(initialCandidates(POSSIBLE_WORDS)), 0);

    return () => {
      w.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pattern: Pattern | null = useMemo(() => {
    const p = tiles.join('');
    return isValidPattern(p) ? (p as Pattern) : null;
  }, [tiles]);

  const weights = useMemo(() => {
    const past = knownPastAnswers(new Date());
    const w = Math.max(0, Math.min(1, pastAnswerWeight));
    return candidates.map((x) => (past.has(x) ? w : 1));
  }, [candidates, pastAnswerWeight]);

  const topGuessesList = useMemo(() => {
    if (!showTop) return [];
    // Keep this reasonably fast on mobile by limiting the search space a bit when candidates is huge.
    const space = candidates.length > 200 ? allowedGuesses.slice(0, 4000) : allowedGuesses;
    return topGuesses({ candidates, weights, allowedGuesses: space, limit: topN });
  }, [showTop, candidates, weights, allowedGuesses, topN]);

  function setGuessToRecommended(nextCandidates: string[]) {
    computeRecommended(nextCandidates);
  }

  function onApplyFeedback() {
    setError(null);
    const g = normalizeWord(guess);
    if (g.length !== 5) return setError('Guess must be 5 letters.');
    if (!allowedGuesses.includes(g)) return setError('Not in allowed guess list.');
    if (!pattern) return setError('Feedback pattern must be 5 tiles.');

    const next = filterCandidatesByFeedback({ candidates, guess: g, pattern });
    setHistory((h) => [...h, { guess: g, pattern }]);
    setCandidates(next);
    setGuessToRecommended(next);
  }

  function onReset() {
    setError(null);
    const next = initialCandidates(POSSIBLE_WORDS);
    setCandidates(next);
    setHistory([]);
    setGuessToRecommended(next);
  }

  // Persist + recompute recommendation when slider changes.
  useEffect(() => {
    try {
      localStorage.setItem(PAST_WEIGHT_KEY, String(pastAnswerWeight));
    } catch {
      // ignore
    }
    computeRecommended(candidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastAnswerWeight]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Wordle Helper</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Probe-word friendly solver (entropy early, then finishes with candidates).
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Past-answer penalty: {Math.round(pastAnswerWeight * 100)}% likely (relative to unused answers).
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Remaining candidates</div>
              <div className="text-2xl font-semibold">{candidates.length.toLocaleString()}</div>
            </div>
            <button
              onClick={onReset}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Reset
            </button>
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Past answer weight</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={pastAnswerWeight}
                onChange={(e) => setPastAnswerWeight(Number(e.target.value))}
                className="w-full"
                aria-label="Past answer weight"
              />
              <div className="w-14 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {Math.round(pastAnswerWeight * 100)}%
              </div>
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              0% = never allow past answers • 100% = treat them like any other word
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recommended guess</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-36 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-lg font-semibold tracking-widest lowercase outline-none focus:border-zinc-500 dark:border-zinc-700"
                maxLength={5}
              />
              {recommended && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  entropy: {Number.isFinite(recommended.score) ? recommended.score.toFixed(3) : '—'}
                  {lastComputeMs != null ? ` • ${Math.round(lastComputeMs)}ms` : ''}
                </div>
              )}
              {isComputing && <div className="text-xs text-zinc-500 dark:text-zinc-400">computing…</div>}
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Enter Wordle feedback</div>
              <div className="mt-2 flex gap-2">
                {tiles.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setTiles((prev) => prev.map((x, j) => (j === i ? nextTile(x) : x)))}
                    className={`h-12 w-12 rounded-lg border text-lg font-bold ${tileClass(t)}`}
                    aria-label={`Tile ${i + 1}: ${t}`}
                  >
                    {guess[i]?.toUpperCase() ?? ''}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Tap tiles to cycle: gray → yellow → green</div>
            </div>

            {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

            <div className="mt-4 flex gap-3">
              <button
                onClick={onApplyFeedback}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Apply feedback
              </button>
              <button
                onClick={() => setTiles(['B', 'B', 'B', 'B', 'B'])}
                className="rounded-lg border border-zinc-300 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">History</h2>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={showTop} onChange={(e) => setShowTop(e.target.checked)} />
              show top guesses
            </label>
          </div>

          {history.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No guesses yet.</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <div className="font-mono text-sm">{h.guess.toUpperCase()}</div>
                  <div className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{h.pattern}</div>
                </li>
              ))}
            </ul>
          )}

          {showTop && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Top guesses (entropy)</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">N</span>
                  <input
                    type="number"
                    value={topN}
                    onChange={(e) => setTopN(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                    className="w-16 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                    min={1}
                    max={50}
                  />
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {topGuessesList.map((x) => (
                  <li key={x.guess} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                    <button
                      className="font-mono text-sm underline-offset-2 hover:underline"
                      onClick={() => setGuess(x.guess)}
                      title="Use this guess"
                    >
                      {x.guess.toUpperCase()}
                    </button>
                    <div className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{x.score.toFixed(3)}</div>
                  </li>
                ))}
              </ul>
              {candidates.length > 200 && (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Note: for speed on mobile, top-guess search is capped to the first 4,000 allowed guesses until the candidate list shrinks.
                </div>
              )}
            </div>
          )}
        </section>

        {candidates.length <= 25 && candidates.length > 1 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold">Remaining candidates</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((w) => (
                <button
                  key={w}
                  onClick={() => setGuess(w)}
                  className="rounded-md border border-zinc-200 px-2 py-1 font-mono text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        )}

        {candidates.length === 1 && (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="text-sm font-semibold">Solved</div>
            <div className="mt-1 font-mono text-2xl font-bold">{candidates[0].toUpperCase()}</div>
          </section>
        )}

        <footer className="pb-6 text-xs text-zinc-500 dark:text-zinc-500">
          Tip: if Wordle rejects a probe word, just type a different one—this solver uses a broad allowed list.
        </footer>
      </main>
    </div>
  );
}
