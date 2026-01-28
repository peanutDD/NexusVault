import type { Metric } from 'web-vitals';

function logMetric(metric: Metric) {
  console.log('[vitals]', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  });
}

/**
 * 通过 `?vitals=1` 开启 Web Vitals 采集（默认关闭，避免污染正常日志）。
 *
 * 用法：
 * - 生产构建：`npm run build && npm run preview` 后打开 `http://.../?vitals=1`
 * - DevTools Console 查看 `[vitals]` 输出
 */
export async function reportVitals() {
  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
  onCLS(logMetric);
  onINP(logMetric);
  onLCP(logMetric);
  onFCP(logMetric);
  onTTFB(logMetric);
}

