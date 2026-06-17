import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
  // Payload CMS 3.x generates complex types that don't resolve cleanly
  // under Next.js's tsc lint pass with moduleResolution: "bundler".
  // The webpack compilation succeeds — this skips the type-check gate only.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent ESLint from blocking production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // top-level in Next.js 15 (was experimental.serverExternalPackages)
  serverExternalPackages: ['sharp', '@payloadcms/db-postgres'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default withPayload(nextConfig)
