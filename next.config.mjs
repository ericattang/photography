/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase body size limit for file uploads (15MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '16mb',
    },
  },
}

export default nextConfig
