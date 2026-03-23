'use client';

import { useEffect, useRef, useState } from 'react';

function venmoUrl(): string {
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    return 'venmo://paycharge?txn=pay&recipients=arco42';
  }
  return 'https://venmo.com/arco42';
}

export function SupportPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:text-zinc-400 dark:hover:bg-zinc-800/50 transition-colors"
        aria-label="Support this project"
        title="Support this project"
      >
        &hearts;
      </button>

      {open && (
        <div className="absolute top-7 right-0 z-50 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-1.5 text-[10px] text-zinc-500">support this project</div>
          <div className="flex flex-col gap-1">
            <a
              href="https://ko-fi.com/arco42"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span className="text-sm">&#9749;</span>
              Ko-fi
            </a>
            <a
              href={venmoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <VenmoIcon />
              Venmo
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function VenmoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
      <path d="M19.27 2c.94 1.55 1.36 3.15 1.36 5.18 0 6.45-5.5 14.82-9.97 20.72H3.15L0 3.8l6.8-.62 1.82 14.58C10.7 14.3 13.3 8.68 13.3 5.35c0-1.92-.33-3.23-.94-4.28L19.27 2z" />
    </svg>
  );
}
