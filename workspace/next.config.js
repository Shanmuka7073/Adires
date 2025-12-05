
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
    esmExternals: false, // safer for Firebase
  },

  transpilePackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
  ],

  typescript: {
    ignoreBuildErrors: true, // temporary only
  },

  eslint: {
    ignoreDuringBuilds: true, // temporary only
  },
};

module.exports = withPWA(nextConfig);
