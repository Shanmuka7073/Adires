const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // Handled manually in ServiceWorkerRegister.tsx
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable SW in development to prevent NetworkOnly errors
  buildExcludes: [
    /middleware-manifest\.json$/,
    /app-build-manifest\.json$/,
    /precache-manifest\..*\.js$/,
  ],
  
  runtimeCaching: [
    {
      // EXCLUDE AUTH: Ensure identity requests never get stuck in Service Worker
      urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
    },
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
            "async_hooks": false,
            "buffer": false,
            "events": false,
            "fs": false,
            "https": false,
            "http": false,
            "net": false,
            "path": false,
            "perf_hooks": false,
            "process": false,
            "stream/web": false,
            "stream": false,
            "url": false,
            "util": false,
            "zlib": false,
            "@opentelemetry/context-async-hooks": false,
            "@opentelemetry/exporter-jaeger": false,
            "jaeger-client": false,
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
