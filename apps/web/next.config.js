const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: true,
  },
  // Disable static generation completely
  output: undefined,
  distDir: '.next',
  // Force all pages to be server-side rendered
  generateBuildId: () => 'build-' + Date.now(),
  output: 'standalone',
  swcMinify: true,
  trailingSlash: true,
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
