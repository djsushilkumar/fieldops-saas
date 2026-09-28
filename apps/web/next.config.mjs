/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@fieldops/types',
    '@fieldops/validation',
    '@fieldops/config',
    '@fieldops/design-tokens',
    '@fieldops/api',
  ],
};

export default nextConfig;
