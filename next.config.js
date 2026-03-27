
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Force disabled to use manual registration in ServiceWorkerRegister.tsx
  skipWaiting: true,
  disable: false, 
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  importScripts: ['https://5gvci.com/pwa/10790859'],
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
      // DYNAMIC BUSINESS ROUTES
      urlPattern: /\/dashboard|\/menu/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'business-logic-routes',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/(?:images\.unsplash\.com|picsum\.photos|i\.ibb\.co|storage\.googleapis\.com)\/.*/i,
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
    
    // FIX: Mark Genkit and Telemetry as externals to prevent "require-in-the-middle" build crash
    if (isServer) {
      config.externals.push(
        '@genkit-ai/google-genai',
        'genkit',
        '@opentelemetry/api',
        '@opentelemetry/sdk-node',
        '@opentelemetry/instrumentation'
      );
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
