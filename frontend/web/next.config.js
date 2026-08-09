/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || 'http://localhost:5015';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/hubs/:path*', destination: `${backend}/hubs/:path*` },
    ];
  },
};

module.exports = nextConfig;

