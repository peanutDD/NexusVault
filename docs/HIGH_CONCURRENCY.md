# 高并发优化完整方案

> 针对文件上传下载业务（峰值10万人）的前后端完整优化方案。本文档整合了前端减压手段和后端优化策略。

---

## 📌 方案总览

### 核心目标
- **响应时间**：< 200ms（P99）
- **吞吐量**：> 5k QPS/节点
- **错误率**：< 0.1%

### 优化层次
| 层次 | 重点 | 手段 |
|------|------|------|
| **前端层** | 减少请求、优化渲染 | 防抖/节流、请求合并、虚拟列表 |
| **服务层** | 异步处理、限流熔断 | Tokio异步、限流、熔断 |
| **存储层** | 卸载IO、缓存加速 | 对象存储、CDN、Redis缓存 |
| **数据层** | 索引优化、读写分离 | 复合索引、分页、读写分离 |

---

## 一、前端高并发优化

### 1.1 请求频率控制

| 手段 | 实现位置 | 配置 | 效果 |
|------|----------|------|------|
| **防抖** | `useDebounce.ts` | 搜索 300ms | 请求↓80% |
| **节流** | `useThrottledCallback.ts` | 滚动 400ms、预览 200ms、resize 150ms | 请求↓70-90% |

### 1.2 请求去重与合并

| 手段 | 实现位置 | 配置 | 效果 |
|------|----------|------|------|
| **全局去重** | `globalRequestDedup.ts` | TTL 5s、100条、5s定时清理 | 相同请求复用 |
| **批量合并** | `batchRequest.ts` | 50ms窗口、最多100个ID | 请求↓80-95% |
| **请求取消** | `api.ts` | 同key取消前一请求、60s定时清理 | 无效请求↓40-70% |

### 1.3 缓存策略

| 手段 | 实现位置 | 配置 | 效果 |
|------|----------|------|------|
| **本地缓存** | `fileListCache.ts` | 5min TTL、80条LRU、操作锁防竞态 | 首屏请求↓50-80% |
| **SWR** | `useStaleWhileRevalidate.ts` | 100条LRU、60s定时清理 | 感知延迟降低 |
| **Service Worker** | `vite.config.ts` | 静态预缓存、列表5min、预览7天 | 离线可访问 |

### 1.4 并发控制

| 手段 | 实现位置 | 配置 | 效果 |
|------|----------|------|------|
| **上传队列** | `uploadQueue.ts` | MaxHeap O(log n)、MAX_COST=3 | 防浏览器崩溃 |
| **预览限流** | `files.ts` | 最大并发6、支持AbortSignal | 防资源耗尽 |
| **全局限流** | `requestLimiter.ts` | 20并发、1000队列上限 | 请求平滑 |

### 1.5 渲染优化

| 手段 | 实现位置 | 配置 | 效果 |
|------|----------|------|------|
| **虚拟列表** | `VirtualizedFileGrid.tsx` | 单一RAF、合并resize监听 | 内存↓80-95% |
| **React Compiler** | `vite.config.ts` | babel-plugin-react-compiler | 渲染性能↑2-5x |
| **并发渲染** | `useFileList.ts` | startTransition包装列表更新 | 交互不卡 |
| **Web Worker** | `workerPool.ts` | 池复用、文件数>50时使用 | 主线程不阻塞 |

---

## 二、后端高并发优化（Rust/Axum）

### 2.1 架构优化

| 手段 | 实现方式 | 效果 |
|------|----------|------|
| **负载均衡** | Nginx/Envoy前置 + K8s自动缩放 | 单节点压力↓80% |
| **异步IO** | Tokio runtime + Axum async handler | 响应时间↓50-70% |
| **对象存储** | S3/MinIO + rusoto_s3 | 文件操作延迟↓90% |
| **限流熔断** | governor + fail + Tokio semaphore | 防止雪崩 |

### 2.2 上传优化

| 手段 | 实现方式 | 效果 |
|------|----------|------|
| **分片上传** | Axum multipart + tokio-fs + Redis进度 | 上传成功率↑95% |
| **预签名直传** | rusoto_s3 presign | 服务器压力↓90% |
| **异步队列** | RabbitMQ/Kafka + Tokio spawn | 主线程不阻塞 |

### 2.3 下载优化

| 手段 | 实现方式 | 效果 |
|------|----------|------|
| **CDN缓存** | Cloudflare/AliCDN + S3集成 | 下载速度↑5-10x |
| **Range支持** | Axum range header + tokio-fs stream | 断点续传支持 |
| **预签名直下** | rusoto_s3 presign | 响应<50ms |

### 2.4 列表/搜索优化

| 手段 | 实现方式 | 效果 |
|------|----------|------|
| **缓存优先** | Redis + 5min TTL | 查询时间↓95% |
| **分页优化** | SQL分页 + 复合索引 | 10k+列表<100ms |
| **全文搜索** | Elasticsearch | 搜索<200ms |

---

## 三、关键常量配置

### 前端常量（`frontend/src/constants/index.ts`）

| 命名空间 | 键 | 值 | 说明 |
|----------|----|-----|------|
| FILE_LIST | LIMIT | 100 | 每页条数 |
| FILE_LIST | CACHE_MINUTES | 5 | 列表缓存TTL |
| REQUEST | LIMITER_MAX_CONCURRENT | 20 | 全局限流并发 |
| REQUEST | DEDUP_TTL_MS | 5000 | 请求去重TTL |
| UPLOAD_QUEUE | MAX_COST | 3 | 上传并发成本上限 |

### 后端配置（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| OTEL_EXPORTER_OTLP_ENDPOINT | http://localhost:4317 | OpenTelemetry端点 |
| REDIS_URL | - | Redis连接地址 |
| DATABASE_URL | - | 数据库连接地址 |

---

## 四、监控与可观测性

### 监控指标
- **Prometheus + Grafana**：QPS、延迟、CPU/IO、错误率
- **Sentry**：错误捕获与追踪
- **Jaeger**：分布式链路追踪

### 性能目标
| 指标 | 目标值 |
|------|--------|
| 上传/下载INP | < 200ms |
| 列表LCP | < 2s |
| 响应P99 | < 500ms |
| 缓存命中率 | > 80% |

---

## 五、实施路线图

### 第一阶段（1-2周）
1. ✅ 前端：防抖/节流、请求去重、全局限流
2. ✅ 后端：异步IO、对象存储、基础限流

### 第二阶段（2-4周）
1. ✅ 前端：虚拟列表、SWR缓存、Service Worker
2. ✅ 后端：Redis缓存、CDN集成、分页优化

### 第三阶段（长期）
1. ✅ 前端：React Compiler、Web Worker池
2. ✅ 后端：Elasticsearch、读写分离、分布式追踪

---

## 📋 参考文档

- `FEATURE_FLAGS.md`：功能开关矩阵与接口边界
- `BILIBILI_TECH_UPGRADE.md`：B站技术实践参考
- `BACKEND_UPGRADE_2026-04-28.md`：后端依赖升级指南