'use client';

import { useEffect, useSyncExternalStore } from 'react';

// The <html> "dark" class is the source of truth; this component subscribes to it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggle() {
    const next = !dark;
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
