/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'

const nextConfig = {
  // Strict mode causes double renders/effects in dev — keep it on for production
  // (where it's no-op anyway) but off for dev so the dashboard doesn't run every
  // expensive aggregation twice.
  reactStrictMode: !isDev,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

export default nextConfig
