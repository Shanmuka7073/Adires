
const withPWA = require('next-pwa')({
  dest: 'public',
  register: false, // DISABLED: We handle registration manually in ServiceWorkerRegister.tsx to avoid conflicts
  skipWaiting: true,
  disable: false, // Force enabled for production stability
  buildExcludes: [/middleware-manifest\.json$/],
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
      bodySizeLimit: '10mb',
    },
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
    
    // Externalize problematic Genkit dependencies to prevent "Critical dependency" build warnings
    if (isServer) {
        config.externals.push('@genkit-ai/google-genai', 'genkit', '@opentelemetry/api', 'require-in-the-middle', 'import-in-the-middle');
    }
    
    // Rule to handle raw file imports for .rules files
    config.module.rules.push({
      test: /\.rules$/,
      type: 'asset/source',
    });

    // Suppress specific warnings during build
    config.ignoreWarnings = [
        { module: /require-in-the-middle/ },
        { message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/ }
    ];

    return config
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = withPWA(nextConfig);
