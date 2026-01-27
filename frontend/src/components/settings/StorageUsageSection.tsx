import { memo, useRef, useEffect } from 'react';
import { formatBytes } from '../../utils/format';
import { cn } from '../../utils/cn';

interface StorageUsage {
  total_size: number;
  file_count: number;
  total_size_mb: number;
  quota: number | null;
  quota_mb: number | null;
  usage_percent: number | null;
  is_unlimited: boolean;
}

interface StorageUsageSectionProps {
  storageUsage: StorageUsage | null;
}

const StorageUsageSection = memo(function StorageUsageSection({ storageUsage }: StorageUsageSectionProps) {
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || !storageUsage?.usage_percent) return;
    const pct = `${Math.min(storageUsage.usage_percent, 100)}%`;
    el.style.setProperty('--storage-progress-pct', pct);
  }, [storageUsage?.usage_percent]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">存储使用情况</h2>
      {storageUsage ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">已使用存储</label>
              {storageUsage.usage_percent !== null && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    storageUsage.usage_percent >= 90 && 'text-red-400',
                    storageUsage.usage_percent >= 75 &&
                      storageUsage.usage_percent < 90 &&
                      'text-yellow-400',
                    storageUsage.usage_percent < 75 && 'text-green-400'
                  )}
                >
                  {storageUsage.usage_percent}%
                </span>
              )}
            </div>
            <p className="text-white text-2xl font-bold">
              {formatBytes(storageUsage.total_size)}
            </p>
            <p className="text-gray-400 text-sm">
              ({storageUsage.total_size_mb} MB)
              {storageUsage.quota_mb !== null && (
                <span> / {storageUsage.quota_mb} MB</span>
              )}
            </p>
          </div>

          {storageUsage.quota !== null && storageUsage.usage_percent !== null && (
            <div>
              <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                <div
                  ref={progressBarRef}
                  className={cn(
                    'storage-progress-fill h-3 rounded-full transition-all',
                    storageUsage.usage_percent >= 90 && 'bg-red-500',
                    storageUsage.usage_percent >= 75 &&
                      storageUsage.usage_percent < 90 &&
                      'bg-yellow-500',
                    storageUsage.usage_percent < 75 && 'bg-green-500'
                  )}
                />
              </div>
              {storageUsage.usage_percent >= 90 && (
                <p className="text-red-400 text-sm">
                  ⚠️ 存储配额即将用尽，请及时清理文件
                </p>
              )}
              {storageUsage.usage_percent >= 75 &&
                storageUsage.usage_percent < 90 && (
                  <p className="text-yellow-400 text-sm">
                    ⚠️ 存储使用率较高，建议清理不需要的文件
                  </p>
                )}
            </div>
          )}

          {storageUsage.is_unlimited && (
            <p className="text-gray-400 text-sm">存储配额：无限制</p>
          )}

          <div>
            <label className="text-sm text-gray-400">文件数量</label>
            <p className="text-white">{storageUsage.file_count} 个文件</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-400">加载中...</p>
      )}
    </div>
  );
});

export default StorageUsageSection;
