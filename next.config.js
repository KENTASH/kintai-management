/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: ['api.dicebear.com'], // アバター画像のドメインを許可
  },

  experimental: {
    appDir: true, // `app/` ディレクトリを有効化
  },
};

module.exports = nextConfig;
