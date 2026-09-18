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
  swcMinify: true,
  trailingSlash: true,
  // Local dev: proxy /api/* al backend (en testing/prod lo resuelve Nginx antes de llegar a Next)
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
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
