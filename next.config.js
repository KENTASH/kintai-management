/** @type {import('next').NextConfig} */
const nextConfig = {
  // 開発時に export と unoptimized を無効化
  // output: 'export',

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: ['api.dicebear.com'], // アバター画像のドメインを許可
  },

  // experimental セクションごと削除
};

module.exports = nextConfig;
