import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 静态资源预缓存（排除频繁变化的 HTML）
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        // 不预缓存 HTML，让其走 NetworkFirst
        navigateFallback: null,
        runtimeCaching: [
          // HTML 页面：NetworkFirst，短缓存
          {
            urlPattern: /^https?:\/\/[^/]+\/?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 }, // 5 分钟
              cacheableResponse: { statuses: [200] }, // 仅缓存成功响应
              networkTimeoutSeconds: 3,
            },
          },
          // 文件列表 API：NetworkFirst，短缓存（数据频繁变化）
          {
            urlPattern: /\/api\/files\?/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'file-list-cache',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 }, // 5 分钟
              cacheableResponse: { statuses: [200] }, // 仅缓存成功响应，不缓存 status 0
              networkTimeoutSeconds: 10,
            },
          },
          // 文件夹 API：NetworkFirst，短缓存
          {
            urlPattern: /\/api\/folders(\/contents)?(\?|$)/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'folders-cache',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 5 }, // 5 分钟
              cacheableResponse: { statuses: [200] }, // 仅缓存成功响应
              networkTimeoutSeconds: 10,
            },
          },
          // 文件预览 API：CacheFirst，长缓存（文件内容不变）
          {
            urlPattern: /\/api\/files\/[^/]+\/preview/,
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'preview-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 天
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
    // Gzip 压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // 只压缩大于 1KB 的文件
    }),
    // Brotli 压缩 (更高压缩率)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
    }),
    // Bundle 分析 (仅在 analyze 模式下启用)
    process.env.ANALYZE === 'true' &&
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // 表单处理
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // 状态管理
          'vendor-state': ['zustand'],
          // 工具库
          'vendor-utils': ['axios', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'axios'],
  },
});
