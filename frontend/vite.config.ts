import { defineConfig, configDefaults } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";
// import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from "rollup-plugin-visualizer";
import { manualChunkName } from "./vite.manualChunks";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://localhost:3000";

  return {
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   injectRegister: 'auto', // 自动注入 registration script
    //   manifest: false, // 不自动生成 manifest，假设已存在或不需要
    //   workbox: {
    //     // 彻底禁用 globPatterns，避免扫描目录导致 EISDIR
    //     // 我们只依赖 runtimeCaching 进行动态缓存
    //     globPatterns: [],
    //     // 不预缓存 HTML，让其走 NetworkFirst
    //     navigateFallback: null,
    //     runtimeCaching: [
    //       // HTML 页面：NetworkFirst，短缓存
    //       {
    //         urlPattern: /^https?:\/\/[^/]+\/?$/,
    //         handler: 'NetworkFirst',
    //         options: {
    //           cacheName: 'html-cache',
    //           expiration: { maxEntries: 10, maxAgeSeconds: 60 * 5 }, // 5 分钟
    //           cacheableResponse: { statuses: [200] }, // 仅缓存成功响应
    //           networkTimeoutSeconds: 3,
    //         },
    //       },
    //       // 文件列表 API：NetworkFirst，短缓存（数据频繁变化）
    //       {
    //         urlPattern: /\/api\/files\?/,
    //         handler: 'NetworkFirst',
    //         method: 'GET',
    //         options: {
    //           cacheName: 'file-list-cache',
    //           expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 }, // 5 分钟
    //           cacheableResponse: { statuses: [200] }, // 仅缓存成功响应，不缓存 status 0
    //           networkTimeoutSeconds: 10,
    //         },
    //       },
    //       // 文件夹 API：NetworkFirst，短缓存
    //       {
    //         urlPattern: /\/api\/folders(\/contents)?(\?|$)/,
    //         handler: 'NetworkFirst',
    //         method: 'GET',
    //         options: {
    //           cacheName: 'folders-cache',
    //           expiration: { maxEntries: 32, maxAgeSeconds: 60 * 5 }, // 5 分钟
    //           cacheableResponse: { statuses: [200] }, // 仅缓存成功响应
    //           networkTimeoutSeconds: 10,
    //         },
    //       },
    //       // 文件预览 API：CacheFirst，长缓存（文件内容不变）
    //       {
    //         urlPattern: /\/api\/files\/[^/]+\/preview/,
    //         handler: 'CacheFirst',
    //         method: 'GET',
    //         options: {
    //           cacheName: 'preview-cache',
    //           expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 天
    //           cacheableResponse: { statuses: [200] },
    //         },
    //       },
    //     ],
    //   },
    // }),
    // Gzip 压缩
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024, // 只压缩大于 1KB 的文件
    }),
    // Brotli 压缩 (更高压缩率)
    compression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
    }),
    // Bundle 分析 (仅在 analyze 模式下启用)
    process.env.ANALYZE === "true" &&
      visualizer({
        open: true,
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  server: {
    // 允许通过局域网 IP / 自定义域名（如 files.local）访问开发服务器
    host: "0.0.0.0",
    // 允许任意 Host（本地开发环境，方便同时用 IP 和 files.local 访问）
    allowedHosts: true,
    // 开发环境下将 /api/* 请求代理到后端
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/dav": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    target: "es2015",
    rollupOptions: {
      output: {
        // 使用函数形式的 manualChunks 实现更细粒度的代码拆分
        manualChunks: manualChunkName,
      },
    },
    chunkSizeWarningLimit: 500,
    cssCodeSplit: true,
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "zustand",
      "axios",
      "@tanstack/react-query",
      "@tanstack/react-query-devtools",
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setupTests.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "src/test/**",
        "src/vite-env.d.ts",
        "**/*.d.ts",
        "e2e/**",
        "node_modules/**",
      ],
    },
  },
  };
});
