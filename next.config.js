
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
      bodySizeLimit: '4.5mb',
    },
    // Setting to false is often safer for compatibility with various libraries, including Firebase.
    esmExternals: false,
  },

  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    if (!isServer) {
        // Prevent bundling of server-only modules on the client
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
    return config
  },

  transpilePackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
  ],

  typescript: {
    // Re-enabling build errors is a good practice for production.
    ignoreBuildErrors: false,
  },

  eslint: {
    // Re-enabling linting during builds is a good practice.
    ignoreDuringBuilds: false,
  },
};

module.exports = withPWA(nextConfig);
