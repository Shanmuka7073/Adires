
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Handled manually in ServiceWorkerRegister.tsx
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [
    /middleware-manifest\.json$/, 
    /app-build-manifest\.json$/,
    /precache-manifest\..*\.js$/,
    // EXCLUDE HEAVY SOURCE HELP PAGES FROM PRECACHE
    /dashboard\/admin\/.*-help.*/
  ],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/i\.ibb\.co\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'external-images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            net: false,
            dns: false,
            tls: false,
            fs: false,
            child_process: false,
        };
    }
    
    if (isServer) {
        config.externals.push(
            '@genkit-ai/google-genai', 
            'genkit', 
            '@opentelemetry/api'
        );
    }
    
    return config;
  },
};

module.exports = withPWA(nextConfig);
