
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LocalBasket',
    short_name: 'LocalBasket',
    description: 'Your local grocery and restaurant market, powered by AI.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0FFF0',
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
