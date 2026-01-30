// 浏览器检测工具

interface BrowserInfo {
  name: string;
  version: number;
  isSupported: boolean;
}

// 支持的浏览器版本
const SUPPORTED_BROWSERS = {
  chrome: 88,
  firefox: 85,
  safari: 14,
  edge: 88,
};

/**
 * 检测浏览器类型和版本
 */
export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  let name = 'unknown';
  let version = 0;

  // 检测 Chrome
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    name = 'chrome';
    const match = userAgent.match(/chrome\/(\d+)\./);
    if (match) {
      version = parseInt(match[1], 10);
    }
  }
  // 检测 Firefox
  else if (userAgent.includes('firefox')) {
    name = 'firefox';
    const match = userAgent.match(/firefox\/(\d+)\./);
    if (match) {
      version = parseInt(match[1], 10);
    }
  }
  // 检测 Safari
  else if (userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('edg')) {
    name = 'safari';
    const match = userAgent.match(/version\/(\d+)\./);
    if (match) {
      version = parseInt(match[1], 10);
    }
  }
  // 检测 Edge
  else if (userAgent.includes('edg')) {
    name = 'edge';
    const match = userAgent.match(/edg\/(\d+)\./);
    if (match) {
      version = parseInt(match[1], 10);
    }
  }

  const minVersion = SUPPORTED_BROWSERS[name as keyof typeof SUPPORTED_BROWSERS];
  const isSupported = minVersion ? version >= minVersion : false;

  return {
    name,
    version,
    isSupported,
  };
}

/**
 * 检查浏览器是否支持
 */
export function isBrowserSupported(): boolean {
  return detectBrowser().isSupported;
}
