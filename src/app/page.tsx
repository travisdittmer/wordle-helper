'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ALLOWED_WORDS, POSSIBLE_WORDS, WORDLIST_META } from '@/lib/wordlists';
import { isValidPattern, Pattern, Tile } from '@/lib/wordle/feedback';
import { initialCandidates, knownPastAnswers, pastAnswerCounts, todayKey } from '@/lib/wordle/history';
import { computeWeights, DEFAULT_WEIGHT_CONFIG } from '@/lib/wordle/weights';
import { filterCandidatesByFeedback, topGuesses, scoreGuessWeightedEntropy } from '@/lib/wordle/solver';
import type { WorkerResponse } from '@/lib/wordle/solverWorker';
import { chooseCandidateSet, isStaleWorkerResponse, shouldCacheFirstGuess } from '@/lib/wordle/workerProtocol';
import Link from 'next/link';
import { FeedbackEntry } from '@/components/FeedbackEntry';
import { GuessHistory } from '@/components/GuessHistory';
import { InfoModal } from '@/components/InfoModal';
import { VisualKeyboard } from '@/components/VisualKeyboard';
import type { LetterState } from '@/components/VisualKeyboard';
import { AnswerZone } from '@/components/AnswerZone';
import { AnalysisDrawer } from '@/components/AnalysisDrawer';

import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { SupportPopover } from '@/components/SupportPopover';
import { ExploreAlternatives } from '@/components/ExploreAlternatives';
import { ThemeToggle } from '@/components/ThemeToggle';

function normalizeWord(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Detect contradictions between accumulated feedback and a new guess+pattern.
 * Returns a warning string if a contradiction is found, null otherwise.
 *
 * Contradictions detected:
 * - A letter was Yellow/Green in a prior guess (confirmed present) but is now Black
 *   in the new guess with no duplicate-letter explanation.
 */
function detectFeedbackContradiction(
  history: Array<{ guess: string; pattern: Pattern }>,
  newGuess: string,
  newPattern: Pattern,
): string | null {
  // Build knowledge from prior guesses: minimum letter counts confirmed present.
  const minCounts = new Map<string, number>();
  for (const { guess, pattern } of history) {
    const counts = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      const tile = pattern[i] as Tile;
      if (tile === 'G' || tile === 'Y') {
        const ch = guess[i];
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    for (const [ch, n] of counts) {
      minCounts.set(ch, Math.max(minCounts.get(ch) ?? 0, n));
    }
  }

  // Check the new guess for contradictions.
  // Count how many of each letter are Yellow/Green vs Black in the new guess.
  const newPresent = new Map<string, number>();
  const newAbsent = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    const ch = newGuess[i];
    const tile = newPattern[i] as Tile;
    if (tile === 'G' || tile === 'Y') {
      newPresent.set(ch, (newPresent.get(ch) ?? 0) + 1);
    } else {
      newAbsent.set(ch, (newAbsent.get(ch) ?? 0) + 1);
    }
  }

  // A Black tile for letter X means the answer has at most (presentCount) copies of X.
  // If prior guesses established more copies exist, that's a contradiction.
  for (const [ch, absentCount] of newAbsent) {
    if (absentCount === 0) continue;
    const priorMin = minCounts.get(ch) ?? 0;
    if (priorMin === 0) continue;
    const currentPresent = newPresent.get(ch) ?? 0;
    // The new feedback implies the answer has exactly `currentPresent` copies of ch.
    // But prior feedback established at least `priorMin` copies.
    if (currentPresent < priorMin) {
      return `Possible contradiction: "${ch.toUpperCase()}" was confirmed present in a prior guess but is marked gray here. Double-check your tiles.`;
    }
  }

  return null;
}

/** Derive keyboard letter states from guess history. */
function deriveLetterStates(history: Array<{ guess: string; pattern: Pattern }>): Map<string, LetterState> {
  const states = new Map<string, LetterState>();
  for (const { guess, pattern } of history) {
    for (let i = 0; i < 5; i++) {
      const letter = guess[i];
      const tile = pattern[i] as Tile;
      const current = states.get(letter) ?? 'unknown';
      if (tile === 'G') {
        states.set(letter, 'correct');
      } else if (tile === 'Y' && current !== 'correct') {
        states.set(letter, 'present');
      } else if (tile === 'B' && current === 'unknown') {
        states.set(letter, 'absent');
      }
    }
  }
  return states;
}

export default function Home() {
  const [candidates, setCandidates] = useState<string[]>(() => initialCandidates(POSSIBLE_WORDS));
  const [guess, setGuess] = useState<string>('');
  const [tiles, setTiles] = useState<Tile[]>(['B', 'B', 'B', 'B', 'B']);
  const [history, setHistory] = useState<Array<{ guess: string; pattern: Pattern }>>([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lastComputeMs, setLastComputeMs] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisGuess, setAnalysisGuess] = useState<string>('');

  // Undo stack: stores previous states so we can revert.
  const [undoStack, setUndoStack] = useState<Array<{
    candidates: string[];
    broadCandidates: string[];
  }>>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestRequestedCandidateCountRef = useRef(0);

  const allowedGuesses = useMemo(() => Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS])), []);
  const [broadCandidates, setBroadCandidates] = useState<string[]>(() => Array.from(new Set([...ALLOWED_WORDS, ...POSSIBLE_WORDS])));
  const allowedGuessSet = useMemo(() => new Set(allowedGuesses), [allowedGuesses]);
  const initialCandidateCount = useMemo(() => initialCandidates(POSSIBLE_WORDS).length, []);

  const [recommended, setRecommended] = useState<{ guess: string; score: number } | null>(null);

  const FIRST_GUESS_CACHE_KEY = `wordle-helper:first-guess:v1:${todayKey()}`;

  const computeRecommended = useCallback((nextCandidates: string[]) => {
    const w = workerRef.current;
    if (!w) return;

    if (nextCandidates.length === 0) {
      setIsComputing(false);
      setLastComputeMs(null);
      setRecommended(null);
      return;
    }

    // Send all candidates (including past answers) to the worker.
    // The worker applies PAST_ANSWER_WEIGHT to deprioritize them
    // without fully excluding them, since NYT now reuses past answers.
    const requestId = ++requestIdRef.current;
    latestRequestedCandidateCountRef.current = nextCandidates.length;
    setIsComputing(true);
    setLastComputeMs(null);
    w.postMessage({ type: 'compute', requestId, candidates: nextCandidates });
  }, []);

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
    if (workerRef.current) return;
    const w = new Worker(new URL('../lib/wordle/solverWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;

    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;

      if (isStaleWorkerResponse(msg, requestIdRef.current)) {
        return;
      }

      if (msg.type === 'error') {
        setError(`Solver error: ${msg.message}`);
        setIsComputing(false);
        setLastComputeMs(null);
        return;
      }

      if (msg.type === 'result') {
        setRecommended({ guess: msg.guess, score: msg.score });
        setGuess(msg.guess);
        setTiles(['B', 'B', 'B', 'B', 'B']);
        setError(null);
        setIsComputing(false);
        setLastComputeMs(msg.tookMs);

        if (shouldCacheFirstGuess(latestRequestedCandidateCountRef.current, initialCandidateCount)) {
          saveCachedFirstGuess({ guess: msg.guess, score: msg.score });
        }
      }
    };

    const cached = loadCachedFirstGuess();
    if (cached) {
      queueMicrotask(() => {
        setRecommended(cached.score != null ? { guess: cached.guess, score: cached.score } : null);
        setGuess(cached.guess);
        setTiles(['B', 'B', 'B', 'B', 'B']);
      });
    }

    queueMicrotask(() => computeRecommended(initialCandidates(POSSIBLE_WORDS)));

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
    const counts = pastAnswerCounts(new Date());
    return computeWeights(candidates, counts, DEFAULT_WEIGHT_CONFIG);
  }, [candidates]);

  const activeCandidates = useMemo(() => {
    return candidates.filter((_, i) => weights[i] > 0);
  }, [candidates, weights]);

  const activeWeights = useMemo(() => {
    return weights.filter((w) => w > 0);
  }, [weights]);

  const remainingCandidatesDisplay = activeCandidates.length;

  const candidateSet = useMemo(() => new Set(candidates), [candidates]);
  const isRecommendedProbe = recommended ? !candidateSet.has(recommended.guess) : false;

  const topGuessesList = useMemo(() => {
    if (!explorerOpen) return [];
    const space = candidates.length > 200 ? allowedGuesses.slice(0, 4000) : allowedGuesses;
    const list = topGuesses({ candidates, weights, allowedGuesses: space, limit: 50 });
    // Ensure the solver's recommended guess appears in the list (the worker uses
    // heuristic scoring which may pick a word not top-ranked by pure entropy).
    if (recommended && !list.some(g => g.guess === recommended.guess)) {
      const recScore = scoreGuessWeightedEntropy(recommended.guess, candidates, weights);
      list.push({ guess: recommended.guess, score: recScore });
      list.sort((a, b) => b.score - a.score);
    }
    return list;
  }, [explorerOpen, candidates, weights, allowedGuesses, recommended]);

  // Derive keyboard letter states from history.
  const letterStates = useMemo(() => deriveLetterStates(history), [history]);

  const recommendedGuessStr = recommended?.guess ?? '';

  function onApplyFeedback() {
    setError(null);
    setDataWarning(null);
    const g = normalizeWord(guess);
    if (g.length !== 5) return setError('Guess must be 5 letters.');
    if (!allowedGuessSet.has(g)) return setError('Not in allowed guess list.');
    if (!pattern) return setError('Feedback pattern must be 5 tiles.');

    // Warn about feedback contradictions before filtering.
    const contradiction = detectFeedbackContradiction(history, g, pattern);
    if (contradiction) setDataWarning(contradiction);

    const nextCanonical = filterCandidatesByFeedback({ candidates, guess: g, pattern });
    const nextBroad = filterCandidatesByFeedback({ candidates: broadCandidates, guess: g, pattern });

    const past = knownPastAnswers(new Date());
    const { next, warning } = chooseCandidateSet(nextCanonical, nextBroad, past);
    if (warning) setDataWarning(warning);

    if (next.length === 0) {
      return setError('No possible answers remain. Double-check your feedback tiles for this guess.');
    }

    // Check if all remaining candidates are past answers — possibly a reused answer
    const activeNext = next.filter(w => !past.has(w));
    if (activeNext.length === 0) {
      setDataWarning('All remaining candidates are past Wordle answers — the answer may be a reuse. Double-check your feedback tiles if this seems wrong.');
    }

    // Push current state to undo stack before applying.
    setUndoStack((stack) => [...stack, { candidates, broadCandidates }]);
    setHistory((h) => [...h, { guess: g, pattern }]);
    setBroadCandidates(nextBroad);
    setCandidates(next);
    computeRecommended(next);
    setAnalysisOpen(false);
  }

  function onUndo() {
    if (undoStack.length === 0 || history.length === 0) return;

    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setHistory((h) => h.slice(0, -1));
    setCandidates(prev.candidates);
    setBroadCandidates(prev.broadCandidates);
    setError(null);
    setDataWarning(null);
    computeRecommended(prev.candidates);
    setAnalysisOpen(false);
  }

  function onReset() {
    setError(null);
    setDataWarning(null);
    const next = initialCandidates(POSSIBLE_WORDS);
    setCandidates(next);
    setBroadCandidates(allowedGuesses);
    setHistory([]);
    setUndoStack([]);
    computeRecommended(next);
    setAnalysisOpen(false);
  }

  return (
    <div className="relative z-10 min-h-screen text-zinc-900 dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
          <OnboardingOverlay />
          {/* Slim header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Wordle Helper</h1>
              <button
                onClick={() => setShowInfo(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="How does this work?"
                title="How does this work?"
              >
                i
              </button>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <SupportPopover />
              <Link
                href="/history"
                target="_blank"
                className="text-xs text-zinc-500 underline-offset-2 hover:underline hover:text-zinc-300"
              >
                History
              </Link>
            </div>
          </header>

          {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

          {/* Solver Composer — unified recommendation + feedback */}
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-gradient-to-b dark:from-zinc-900 dark:to-zinc-950">
            <AnswerZone
              variant="embedded"
              candidateCount={remainingCandidatesDisplay}
              candidates={activeCandidates}
              recommended={recommended}
              isComputing={isComputing}
              onSelectWord={(w) => setGuess(w)}
              history={history}
              isProbe={isRecommendedProbe}
              onWhyClick={() => { setAnalysisGuess(recommended?.guess ?? ''); setAnalysisOpen(true); }}
            />

            {remainingCandidatesDisplay > 1 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800/50" />
            )}

            {remainingCandidatesDisplay > 1 && (
              <div className="p-5">
                <FeedbackEntry
                  guess={guess}
                  onGuessChange={setGuess}
                  tiles={tiles}
                  onTilesChange={setTiles}
                  onApply={onApplyFeedback}
                  error={error}
                  dataWarning={dataWarning}
                  statusLabel={
                    recommended && guess === recommended.guess
                      ? `Suggested guess${isRecommendedProbe ? ' · info probe' : ''}`
                      : recommended && guess !== recommended.guess && guess.length === 5
                        ? 'Your guess'
                        : null
                  }
                  onUseSuggestion={
                    recommended && guess !== recommended.guess
                      ? () => setGuess(recommended.guess)
                      : undefined
                  }
                  onCompare={
                    recommended && guess !== recommended.guess && guess.length === 5 && allowedGuessSet.has(normalizeWord(guess))
                      ? () => { setAnalysisGuess(normalizeWord(guess)); setAnalysisOpen(true); }
                      : undefined
                  }
                />
              </div>
            )}
          </section>

          {/* Guess history + undo/reset */}
          {history.length > 0 && (
            <section className="rounded-xl border border-zinc-200/50 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-400">Guesses</h2>
                <div className="flex gap-3 text-xs">
                  <button onClick={onUndo} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline-offset-2 hover:underline">&#8617; Undo</button>
                  <button onClick={onReset} className="text-red-400/70 hover:text-red-500 dark:text-red-500/50 dark:hover:text-red-400 underline-offset-2 hover:underline">Start over</button>
                </div>
              </div>
              <div className="mt-3">
                <GuessHistory history={history} />
              </div>
            </section>
          )}

          {/* Keyboard */}
          {history.length > 0 && (
            <section className="rounded-xl border border-zinc-200/50 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-zinc-400 mb-3">Keyboard</h2>
              <VisualKeyboard letterStates={letterStates} />
            </section>
          )}

          <ExploreAlternatives
            open={explorerOpen}
            onOpenChange={setExplorerOpen}
            guesses={topGuessesList}
            candidateSet={candidateSet}
            onSelectGuess={setGuess}
            candidateCount={remainingCandidatesDisplay}
            totalCount={WORDLIST_META.possibleWordsCount}
            showSpeedNote={candidates.length > 200}
          />
      </main>
      {recommended && (
        <AnalysisDrawer
          open={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          guess={analysisGuess || recommended.guess}
          candidates={activeCandidates}
          weights={activeWeights}
          history={history}
          recommendedGuess={recommended.guess}
        />
      )}
    </div>
  );
}
