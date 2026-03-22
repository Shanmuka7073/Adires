
import { MetadataRoute } from 'next';

/**
 * Global Grozo Platform Manifest
 * Explicitly set with a unique ID to separate it from individual restaurant apps.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'adires-platform-main',
    name: 'Grozo Market',
    short_name: 'Grozo',
    description: 'Hyperlocal marketplace for restaurants, salons, and stores.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FDFCF7',
    theme_color: '#90EE90',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
