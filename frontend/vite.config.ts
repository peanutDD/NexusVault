import { defineConfig } from 'vitest/config';
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
  server: {
    // 允许通过局域网 IP / 自定义域名（如 files.local）访问开发服务器
    host: '0.0.0.0',
    // 允许任意 Host（本地开发环境，方便同时用 IP 和 files.local 访问）
    allowedHosts: true,
    // 开发环境下将 /api/* 请求代理到后端
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        // 使用函数形式的 manualChunks 实现更细粒度的代码拆分
        manualChunks(id) {
          // node_modules 中的依赖
          if (id.includes('node_modules')) {
            // React 核心库
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // 表单处理库
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'vendor-form';
            }
            // 状态管理
            if (id.includes('zustand')) {
              return 'vendor-state';
            }
            // UI 组件库和图标
            if (id.includes('lucide-react') || id.includes('bootstrap-icons')) {
              return 'vendor-ui';
            }
            // 工具库
            if (id.includes('axios') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'vendor-utils';
            }
            // 其他大型依赖单独拆分
            if (id.includes('@tanstack/react-virtual')) {
              return 'vendor-virtual';
            }
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            if (id.includes('zip.js') || id.includes('jszip')) {
              return 'vendor-zip';
            }
            // 其他 node_modules 依赖
            return 'vendor-other';
          }
          
          // 按路由拆分页面代码
          if (id.includes('/src/pages/')) {
            if (id.includes('/pages/Files')) {
              return 'chunk-Files';
            }
            if (id.includes('/pages/Settings')) {
              return 'chunk-Settings';
            }
            if (id.includes('/pages/Share')) {
              return 'chunk-Share';
            }
          }
          
          // 按功能模块拆分组件
          if (id.includes('/src/components/auth/')) {
            return 'chunk-auth';
          }
          
          // 文件相关组件（较大，单独拆分）
          if (id.includes('/src/components/files/')) {
            return 'chunk-files-components';
          }
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setupTests.ts'],
  },
});
