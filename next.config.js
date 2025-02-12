/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    domains: [
      'api.dicebear.com',
      'localhost',
      'bhatjmmdcichmgjlh.supabase.co' // Supabaseのドメインを追加
    ],
    unoptimized: true, // 画像の最適化を無効化（開発環境用）
  },

  // Supabaseの認証を正しく機能させるための設定
  experimental: {
    serverActions: {}, // 修正: true → 空のオブジェクトに変更
  },

  // キャッシュ制御を強化
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          }
        ],
      }
    ]
  },

  output: 'standalone', // 静的エクスポートを回避（Supabaseの認証を維持）
};

module.exports = nextConfig;
