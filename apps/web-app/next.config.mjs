/** @type {import('next').NextConfig} */
const nextConfig = {
  // HashPass Links includes latency-sensitive route handlers and therefore
  // requires the Next.js server runtime rather than a static-only export.
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  transpilePackages: ['@hashpass/ui', '@hashpass/utils', '@hashpass/types', '@hashpass/i18n', '@hashpass/config', '@hashpass/backend'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
    };

    return config;
  },
};

export default nextConfig;
