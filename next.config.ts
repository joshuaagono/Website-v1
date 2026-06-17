import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'

const nextConfig: NextConfig = {
  // Moved from experimental — serverExternalPackages is top-level in Next.js 15
  serverExternalPackages: ['sharp', '@payloadcms/db-postgres'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // Explicitly re-apply the @ alias after withPayload wraps webpack config
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd(), 'src'),
    }
    return config
  },
}

export default withPayload(nextConfig, { configPath: './payload.config.ts' })
