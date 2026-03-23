import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wordle Helper',
    short_name: 'WordleHelper',
    description: 'Solve Wordle faster. Get the best guess instantly, every day.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon.png', sizes: '1024x1024', type: 'image/png' },
    ],
  };
}
