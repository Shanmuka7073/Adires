const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Handled manually in ServiceWorkerRegister.tsx
  skipWaiting: true,
  disable: false, // Force enabled for offline-first health
  buildExcludes: [
    /middleware-manifest\.json$/, 
    /app-build-manifest\.json$/,
    /precache-manifest\..*\.js$/,
  ],
  importScripts: ['https://5gvci.com/pwa/10790859'],
  runtimeCaching: [
    {
      urlPattern: /\.(?:js|css|json|html)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'app-shell',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/(?:i\.ibb\.co|images\.unsplash\.com|picsum\.photos|storage\.googleapis\.com)\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'platform-images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60,
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
            '@opentelemetry/api',
            '@opentelemetry/sdk-node',
            '@opentelemetry/instrumentation'
        );
    }
    
    return config;
  },
};

module.exports = withPWA(nextConfig);