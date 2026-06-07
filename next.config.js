/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

// In dev, Next.js HMR requires 'unsafe-eval'. In production it is not needed.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://openrouter.ai",
  "frame-ancestors 'none'",
].join('; ')

const pagesConfig = {
  output: 'export',
  basePath: '/flyer',
  assetPrefix: '/flyer/',
  trailingSlash: true,
  images: { unoptimized: true },
}

const appConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

const nextConfig = isGitHubPages ? pagesConfig : appConfig

module.exports = nextConfig
