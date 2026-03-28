
import { MetadataRoute } from 'next';

/**
 * Standard Web Manifest Generator
 * Uses valid external URLs for icons to prevent 404 errors during cloud deployment.
 */
export default function manifest(): MetadataRoute.Manifest {
  const ICON_URL = 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png';
  
  return {
    name: 'Adires | Unified Local Market',
    short_name: 'Adires',
    description: 'Connecting you to your trusted neighborhood stores.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#90EE90',
    icons: [
      {
        src: ICON_URL,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: ICON_URL,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
