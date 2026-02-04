import { memo, useRef, useEffect } from 'react';
import { HardDrive } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { cn } from '../../utils/cn';
import type { StorageUsage } from '../../types';
import SettingsCard from './SettingsCard';

interface StorageUsageSectionProps {
  storageUsage: StorageUsage | null;
}

const StorageUsageSection = memo(function StorageUsageSection({
  storageUsage,
}: StorageUsageSectionProps) {
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || storageUsage?.usage_percent == null) return;
    const pct = `${Math.min(storageUsage.usage_percent, 100)}%`;
    el.style.setProperty('--storage-progress-pct', pct);
  }, [storageUsage?.usage_percent]);

  return (
    <SettingsCard
      id="storage"
      title="存储用量"
      description="监控用量与配额，避免上传/合并失败。"
      icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
    >
      {storageUsage ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-wide text-slate-400">已使用</p>
                {storageUsage.usage_percent !== null && (
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      storageUsage.usage_percent >= 90 && 'text-rose-300',
                      storageUsage.usage_percent >= 75 &&
                        storageUsage.usage_percent < 90 &&
                        'text-amber-300',
                      storageUsage.usage_percent < 75 && 'text-emerald-200'
                    )}
                  >
                    {storageUsage.usage_percent}%
                  </span>
                )}
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {formatBytes(storageUsage.total_size)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {storageUsage.total_size_mb} MB
                {storageUsage.quota_mb !== null ? ` / ${storageUsage.quota_mb} MB` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <p className="text-xs tracking-wide text-slate-400">文件数量</p>
              <p className="mt-2 text-2xl font-semibold text-slate-100 tabular-nums">
                {storageUsage.file_count}
              </p>
              <p className="mt-1 text-xs text-slate-400">items</p>
            </div>
          </div>

          {storageUsage.quota !== null && storageUsage.usage_percent !== null && (
            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-200">配额进度</p>
                <p className="text-xs text-slate-400">
                  {storageUsage.is_unlimited ? '无限制' : '有上限'}
                </p>
              </div>
              <div className="mt-3 h-3 w-full rounded-full bg-slate-900/50 ring-1 ring-white/5">
                <div
                  ref={progressBarRef}
                  className={cn(
                    'storage-progress-fill h-3 rounded-full transition-all',
                    'bg-gradient-to-r from-emerald-400/80 to-cyan-400/80',
                    storageUsage.usage_percent >= 90 &&
                      'from-rose-400/80 to-orange-400/80',
                    storageUsage.usage_percent >= 75 &&
                      storageUsage.usage_percent < 90 &&
                      'from-amber-400/80 to-orange-400/80'
                  )}
                />
              </div>

              {storageUsage.usage_percent >= 90 && (
                <p className="mt-3 text-sm text-rose-200">
                  提示：存储配额即将用尽，建议清理无用文件或提升配额。
                </p>
              )}
              {storageUsage.usage_percent >= 75 && storageUsage.usage_percent < 90 && (
                <p className="mt-3 text-sm text-amber-200">
                  提示：存储使用率较高，建议定期清理或归档。
                </p>
              )}
            </div>
          )}

          {storageUsage.is_unlimited && (
            <p className="text-sm text-slate-400">配额：无限制</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">加载中…</p>
      )}
    </SettingsCard>
  );
});

export default StorageUsageSection;
