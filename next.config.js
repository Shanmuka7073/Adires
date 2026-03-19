
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Always enabled for complete offline functionality
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'unsplash-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
      },
    },
    {
      urlPattern: /^https:\/\/i\.ibb\.co\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'external-logos',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/picsum\.photos\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'placeholder-images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      // Aggressive caching for Dashboard and Menu routes to ensure offline navigation
      urlPattern: /\/dashboard|\/menu/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'management-routes',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 24 Hours
        },
        networkTimeoutSeconds: 3, // Fast fallback to cache if internet is table/slow
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
      bodySizeLimit: '4.5mb',
    },
    esmExternals: false,
  },

  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
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
        config.externals.push('@genkit-ai/google-genai', 'genkit', '@opentelemetry/api');
    }
    
    config.module.rules.push({
      test: /\.rules$/,
      type: 'asset/source',
    });

    return config
  },

  transpilePackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
  ],
};

module.exports = withPWA(nextConfig);
