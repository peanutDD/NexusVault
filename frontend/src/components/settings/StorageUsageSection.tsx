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
            <div className="rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]">Used</p>
                {storageUsage.usage_percent !== null && (
                  <span
                    className={cn(
                      'text-[length:var(--settings-text-xs)] font-semibold tabular-nums',
                      storageUsage.usage_percent >= 90 && 'text-[var(--settings-usage-danger)]',
                      storageUsage.usage_percent >= 75 &&
                        storageUsage.usage_percent < 90 &&
                        'text-[var(--settings-usage-warn)]',
                      storageUsage.usage_percent < 75 && 'text-[var(--settings-usage-ok)]'
                    )}
                  >
                    {storageUsage.usage_percent}%
                  </span>
                )}
              </div>
              <p className="font-brand mt-2 text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-[var(--settings-panel-value)]">
                {formatBytes(storageUsage.total_size)}
              </p>
              <p className="mt-1 text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)]">
                {storageUsage.total_size_mb} MB
                {storageUsage.quota !== null ? ` / ${formatBytes(storageUsage.quota)}` : ''}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4">
              <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]">Files</p>
              <p className="font-brand mt-2 text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-[var(--settings-panel-value)] tabular-nums">
                {storageUsage.file_count}
              </p>
              <p className="mt-1 text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)]">items</p>
            </div>
          </div>

          {storageUsage.quota !== null && storageUsage.usage_percent !== null && (
            <div className="rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-brand text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-section-title)]">Quota progress</p>
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-muted)]">
                  {storageUsage.is_unlimited ? 'Unlimited' : 'Limited'}
                </p>
              </div>
              <div className="mt-3 h-3 w-full rounded-full bg-[var(--settings-progress-track-bg)] ring-1 ring-[var(--settings-progress-track-ring)]">
                <div
                  ref={progressBarRef}
                  className={cn(
                    'storage-progress-fill h-3 rounded-full transition-all',
                    'bg-[var(--settings-progress-fill)]',
                    storageUsage.usage_percent >= 90 &&
                      'bg-[var(--settings-progress-fill-danger)]',
                    storageUsage.usage_percent >= 75 &&
                      storageUsage.usage_percent < 90 &&
                      'bg-[var(--settings-progress-fill-warn)]'
                  )}
                />
              </div>

              {storageUsage.usage_percent >= 90 && (
                <p className="font-brand mt-3 text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-progress-danger-text)]">
                  Storage quota almost full. Consider cleaning up or increasing quota.
                </p>
              )}
              {storageUsage.usage_percent >= 75 && storageUsage.usage_percent < 90 && (
                <p className="font-brand mt-3 text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-progress-warn-text)]">
                  Storage usage is high. Consider regular cleanup or archival.
                </p>
              )}
            </div>
          )}

          {storageUsage.is_unlimited && (
            <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]">Quota: unlimited</p>
          )}
        </div>
      ) : (
        <p className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]">Loading…</p>
      )}
    </SettingsCard>
  );
});

export default StorageUsageSection;
