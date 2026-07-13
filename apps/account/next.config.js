/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cbt/shared'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,X-API-Key,X-Crawl-Token,Authorization' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
