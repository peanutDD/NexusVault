import { memo, useRef, useEffect } from 'react';
import { HardDrive } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { cn } from '../../utils/cn';
import type { StorageUsage } from '../../types/files';
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
      title="Storage"
      description="Monitor usage and quota to avoid upload/merge failures."
      icon={<HardDrive className="h-5 w-5" aria-hidden="true" />}
    >
      {storageUsage ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-400">Used</p>
                {storageUsage.usage_percent !== null && (
                  <span
                    className={cn(
                      'text-[length:var(--settings-text-xs)] font-semibold tabular-nums',
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
              <p className="font-brand mt-2 text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-slate-100">
                {formatBytes(storageUsage.total_size)}
              </p>
              <p className="mt-1 text-[length:var(--settings-text-xs)] text-slate-400">
                {storageUsage.total_size_mb} MB
                {storageUsage.quota_mb !== null ? ` / ${storageUsage.quota_mb} MB` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-400">Files</p>
              <p className="font-brand mt-2 text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-slate-100 tabular-nums">
                {storageUsage.file_count}
              </p>
              <p className="mt-1 text-[length:var(--settings-text-xs)] text-slate-400">items</p>
            </div>
          </div>

          {storageUsage.quota !== null && storageUsage.usage_percent !== null && (
            <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-brand text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200">Quota progress</p>
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-400">
                  {storageUsage.is_unlimited ? 'Unlimited' : 'Limited'}
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
                <p className="font-brand mt-3 text-[length:var(--settings-text-sm)] font-normal tracking-wide text-rose-200">
                  Storage quota almost full. Consider cleaning up or increasing quota.
                </p>
              )}
              {storageUsage.usage_percent >= 75 && storageUsage.usage_percent < 90 && (
                <p className="font-brand mt-3 text-[length:var(--settings-text-sm)] font-normal tracking-wide text-amber-200">
                  Storage usage is high. Consider regular cleanup or archival.
                </p>
              )}
            </div>
          )}

          {storageUsage.is_unlimited && (
            <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-slate-400">Quota: unlimited</p>
          )}
        </div>
      ) : (
        <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-slate-400">Loading…</p>
      )}
    </SettingsCard>
  );
});

export default StorageUsageSection;
