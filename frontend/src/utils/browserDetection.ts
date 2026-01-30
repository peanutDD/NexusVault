/**
 * 浏览器检测工具
 * 用于检测用户浏览器类型、版本以及是否支持
 */
import type { BrowserInfo } from '../types';

/**
 * 支持的浏览器版本配置
 */
const SUPPORTED_BROWSERS = {
  chrome: 88,  // 支持 Chrome 88+
  firefox: 85, // 支持 Firefox 85+
  safari: 14,  // 支持 Safari 14+
  edge: 88,    // 支持 Edge 88+
} as const;

/**
 * 检测浏览器类型和版本
 * @returns 浏览器信息对象
 */
export function detectBrowser(): BrowserInfo {
  // 检查 navigator 是否存在（避免在 SSR 环境中出错）
  if (typeof navigator === 'undefined') {
    return {
      name: 'unknown',
      version: 0,
      isSupported: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  let name: string = 'unknown';
  let version: number = 0;

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

  // 检查是否支持
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
 * @returns 是否支持当前浏览器
 */
export function isBrowserSupported(): boolean {
  return detectBrowser().isSupported;
}

/**
 * 获取浏览器支持状态信息
 * @returns 浏览器支持状态的详细信息
 */
export function getBrowserSupportInfo(): {
  browser: BrowserInfo;
  supportedBrowsers: typeof SUPPORTED_BROWSERS;
  message: string;
} {
  const browser = detectBrowser();
  const supportedBrowsers = SUPPORTED_BROWSERS;
  
  let message = '';
  if (!browser.isSupported) {
    if (browser.name === 'unknown') {
      message = '无法检测您的浏览器类型，请使用最新版本的 Chrome、Firefox、Safari 或 Edge 浏览器。';
    } else {
      const requiredVersion = supportedBrowsers[browser.name as keyof typeof supportedBrowsers];
      message = `您的 ${browser.name} 浏览器版本 ${browser.version} 过低，建议升级到 ${requiredVersion} 或更高版本。`;
    }
  }
  
  return {
    browser,
    supportedBrowsers,
    message,
  };
}
