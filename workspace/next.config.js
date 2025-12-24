/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Explicitly configure Turbopack to resolve the conflict with any lingering Webpack settings.
  // An empty object tells Next.js that we acknowledge Turbopack and silences the error.
  experimental: {
    turbopack: {},
  },
};

module.exports = nextConfig;
