import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@repo/types', '@repo/utils'],
  // Каждая копия репозитория открывается по своему адресу `<slug>.localhost`
  // (изоляция cookies между worktree), а dev-сервер Next по умолчанию доверяет
  // только localhost — без этого списка запросы к /_next/* с slug-хоста отклоняются.
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.localhost'],
};

export default nextConfig;
