/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Ensure the card image is bundled into the serverless function.
  // Fonts are embedded as base64 in lib/font-data.ts so no font files needed.
  outputFileTracingIncludes: {
    '/api/generate-card': ['./public/invitation-card.png'],
    '/api/send':          ['./public/invitation-card.png'],
  },
}

module.exports = nextConfig
