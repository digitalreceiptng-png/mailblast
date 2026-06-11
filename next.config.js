/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // Ensure the card PNG is bundled into the serverless function.
    // Fonts are embedded as base64 in lib/font-data.ts so no font files needed.
    outputFileTracingIncludes: {
      '/api/generate-card': ['./public/invitation-card.png'],
      '/api/send':          ['./public/invitation-card.png'],
    },
  },
}

// sharp is a native module — tell webpack not to try bundling it
nextConfig.webpack = (config, { isServer }) => {
  if (isServer) config.externals.push('sharp')
  return config
}

module.exports = nextConfig
