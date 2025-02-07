/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: ['api.dicebear.com'], // アバター画像のドメインを許可
  },

  output: 'standalone', // 静的エクスポートを回避（Supabaseの認証を維持）
};

module.exports = nextConfig;
