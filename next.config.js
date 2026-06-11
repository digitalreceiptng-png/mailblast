/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (isServer) {
      // Keep @napi-rs/canvas as a Node.js native module — don't bundle it
      config.externals.push('@napi-rs/canvas')
    }
    return config
  },
}

module.exports = nextConfig
