/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  // НЕ добавлять output: standalone — ломает Vercel!
}

module.exports = nextConfig
