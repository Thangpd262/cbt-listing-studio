/** @type {import('next').NextConfig} */
const pkg = require('./package.json')
const nextConfig = {
  transpilePackages: ['@cbt/shared'],
  env: {
    // Surfaced in the sidebar + document title (see Sidebar/Layout).
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
}
module.exports = nextConfig
