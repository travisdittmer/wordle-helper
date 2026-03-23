'use client';

import { useEffect, useState } from 'react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates a static letter-texture canvas tile, converts to a tiling background image,
 * and applies a slow CSS drift animation. Near-zero CPU cost after initial render.
 */
export function LetterBackground() {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    const tileSize = 300;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    const canvas = document.createElement('canvas');
    canvas.width = tileSize * dpr;
    canvas.height = tileSize * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Seeded pseudo-random for deterministic tile
    let seed = 42;
    function rand() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const count = 60;
    for (let i = 0; i < count; i++) {
      const x = rand() * tileSize;
      const y = rand() * tileSize;
      const letter = ALPHABET[Math.floor(rand() * 26)];
      const size = 10 + rand() * 14;
      const rotation = (rand() - 0.5) * 0.6;
      const opacity = 0.06 + rand() * 0.06;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.font = `600 ${Math.round(size)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillStyle = `rgba(150, 150, 150, ${opacity})`;
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    }

    setBgUrl(canvas.toDataURL('image/png'));
  }, []);

  if (!bgUrl) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 motion-reduce:animate-none"
      style={{
        zIndex: 0,
        backgroundImage: `url(${bgUrl})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        animation: 'letter-drift 120s linear infinite',
      }}
    />
  );
}
