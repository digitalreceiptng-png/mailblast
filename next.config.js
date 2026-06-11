/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Explicitly include font and card assets in the serverless function bundle.
  // Without this, Vercel's output-file-tracing may omit files that are only
  // referenced by a runtime path string (not a static import).
  outputFileTracingIncludes: {
    '/api/generate-card': [
      './public/fonts/**',
      './public/invitation-card.png',
    ],
    '/api/send': [
      './public/fonts/**',
      './public/invitation-card.png',
    ],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push('@napi-rs/canvas')
    }
    return config
  },
}

module.exports = nextConfig
