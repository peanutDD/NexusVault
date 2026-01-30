import { useEffect, useState } from 'react';
import { isBrowserSupported, detectBrowser } from '../../utils/browserDetection';

interface BrowserCompatibilityWarningProps {
  className?: string;
}

export default function BrowserCompatibilityWarning({ className = '' }: BrowserCompatibilityWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [browserInfo, setBrowserInfo] = useState(detectBrowser());

  useEffect(() => {
    const supported = isBrowserSupported();
    setShowWarning(!supported);
    setBrowserInfo(detectBrowser());
  }, []);

  if (!showWarning) {
    return null;
  }

  const browserNames: Record<string, string> = {
    chrome: 'Chrome',
    firefox: 'Firefox',
    safari: 'Safari',
    edge: 'Edge',
    unknown: '您的浏览器',
  };

  const browserName = browserNames[browserInfo.name] || '您的浏览器';
  const supportedVersions = {
    chrome: '88+',
    firefox: '85+',
    safari: '14+',
    edge: '88+',
    unknown: '最新版本',
  };
  const supportedVersion = supportedVersions[browserInfo.name as keyof typeof supportedVersions] || '最新版本';

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white p-4 shadow-lg ${className}`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.77-2.694-.77-3.464 0L3.34 16c-.77.77-.77 2.072.002 2.83z" />
          </svg>
          <div>
            <h3 className="font-medium">浏览器版本过低</h3>
            <p className="text-sm opacity-90">{browserName} 版本过低，可能导致网站功能异常</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">建议使用 {supportedVersion}</span>
          <button 
            onClick={() => setShowWarning(false)}
            className="text-white hover:text-amber-100 focus:outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
