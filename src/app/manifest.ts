
import { MetadataRoute } from 'next';

/**
 * Standard Web Manifest Generator
 * Fixes the "root element must be a valid JSON object" error by providing a valid schema.
 */
export default function manifest(): MetadataRoute.Manifest {
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
        src: 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
