
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Force enabled for all environments to ensure offline health
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  runtimeCaching: [
    {
      // AD-NETWORK EXCLUSION
      urlPattern: /^https:\/\/5gvci\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      // DYNAMIC BUSINESS ROUTES (RESILIENCE FIX)
      // We use NetworkFirst instead of StaleWhileRevalidate for navigation routes
      // to prevent "NetworkOnly" failures in workstation proxies.
      urlPattern: /\/dashboard|\/menu/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'business-logic-routes',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
        },
        networkTimeoutSeconds: 10, // Fallback to cache if network is slow/failing
      },
    },
    {
      urlPattern: /^https:\/\/(?:images\.unsplash\.com|picsum\.photos|i\.ibb\.co)\/.*/i,
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
      bodySizeLimit: '10mb',
    },
    esmExternals: false,
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
    config.module.rules.push({
      test: /\.rules$/,
      type: 'asset/source',
    });
    return config;
  },
  transpilePackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
  ],
};

module.exports = withPWA(nextConfig);
