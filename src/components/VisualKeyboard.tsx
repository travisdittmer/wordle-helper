'use client';

export type LetterState = 'correct' | 'present' | 'absent' | 'unknown';

function keyClass(state: LetterState): string {
  switch (state) {
    case 'correct':
      return 'bg-emerald-600 border-emerald-700 text-white';
    case 'present':
      return 'bg-amber-500 border-amber-600 text-white';
    case 'absent':
      return 'bg-zinc-400 border-zinc-500 text-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500';
    default:
      return 'bg-zinc-200 border-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-50';
  }
}

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

interface VisualKeyboardProps {
  letterStates: Map<string, LetterState>;
}

export function VisualKeyboard({ letterStates }: VisualKeyboardProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((key) => {
            const state = letterStates.get(key) ?? 'unknown';
            return (
              <div
                key={key}
                className={`flex h-9 w-8 items-center justify-center rounded border text-xs font-bold uppercase ${keyClass(state)}`}
              >
                {key}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
