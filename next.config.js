
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
    esmExternals: 'loose',
  },
  typescript: {
    // This is now set to false to show all TypeScript errors during build.
    ignoreBuildErrors: false,
  },
  eslint: {
    // This is now set to false to show all ESLint errors during build.
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
