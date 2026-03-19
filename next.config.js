
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Enabled in development to allow offline testing in preview
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'unsplash-images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
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
