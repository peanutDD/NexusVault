import { memo, useRef, useEffect } from "react";
import { HardDrive } from "lucide-react";
import { formatBytes } from "../../utils/format";
import { cn } from "../../utils/cn";
import SettingsCard from "./SettingsCard";
import { useStorageUsage } from "../../hooks/useStorageUsage";

const StorageUsageSection = memo(function StorageUsageSection() {
  const { data: storageUsage, isLoading } = useStorageUsage();
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || storageUsage?.usage_percent == null) return;
    const pct = `${Math.min(storageUsage.usage_percent, 100)}%`;
    el.style.setProperty("--storage-progress-pct", pct);
  }, [storageUsage?.usage_percent]);

  return (
    <SettingsCard
      id="storage"
      title="Storage"
      description="Monitor usage and quota to avoid upload/merge failures."
      icon={
        <HardDrive className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" aria-hidden="true" data-oid="no.1nu7" />
      }
      data-oid="31jeowi"
    >
      {!isLoading && storageUsage ? (
        <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]" data-oid="yvquog4">
          <div className="grid gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:grid-cols-2" data-oid="ght-we:">
            <div
              className="rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-panel-shadow)]"
              data-oid="5t21sp4"
            >
              <div
                className="flex items-center justify-between gap-[clamp(0.585rem,1.35vw,0.75rem)]"
                data-oid="7l40t11"
              >
                <p
                  className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]"
                  data-oid="axpx3:d"
                >
                  Used
                </p>
                {storageUsage.usage_percent !== null && (
                  <span
                    className={cn(
                      "text-[length:var(--settings-text-xs)] font-semibold tabular-nums",
                      storageUsage.usage_percent >= 90 &&
                        "text-[var(--settings-usage-danger)]",
                      storageUsage.usage_percent >= 75 &&
                        storageUsage.usage_percent < 90 &&
                        "text-[var(--settings-usage-warn)]",
                      storageUsage.usage_percent < 75 &&
                        "text-[var(--settings-usage-ok)]",
                    )}
                    data-oid="cun:s3k"
                  >
                    {storageUsage.usage_percent}%
                  </span>
                )}
              </div>
              <p
                className="font-brand mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-[var(--settings-panel-value)]"
                data-oid="-eutq2_"
              >
                {formatBytes(storageUsage.total_size)}
              </p>
              <p
                className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)]"
                data-oid="sh1s269"
              >
                {storageUsage.total_size_mb} MB
                {storageUsage.quota !== null
                  ? ` / ${formatBytes(storageUsage.quota)}`
                  : ""}
              </p>
            </div>

            <div
              className="rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-panel-shadow)]"
              data-oid="xg85hgm"
            >
              <p
                className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]"
                data-oid="2tuktzc"
              >
                Files
              </p>
              <p
                className="font-brand mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xl)] font-semibold tracking-wide text-[var(--settings-panel-value)] tabular-nums"
                data-oid="3.kgvaf"
              >
                {storageUsage.file_count}
              </p>
              <p
                className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-panel-muted)]"
                data-oid=".-wf3no"
              >
                items
              </p>
            </div>
          </div>

          {storageUsage.quota !== null &&
            storageUsage.usage_percent !== null && (
              <div
                className="rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-panel-shadow)]"
                data-oid="b.98t02"
              >
                <div
                  className="flex items-center justify-between gap-[clamp(0.585rem,1.35vw,0.75rem)]"
                  data-oid="yn8nwqk"
                >
                  <p
                    className="font-brand text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-section-title)]"
                    data-oid="21ftabo"
                  >
                    Quota progress
                  </p>
                  <p
                    className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-muted)]"
                    data-oid="-d03y4k"
                  >
                    {storageUsage.is_unlimited ? "Unlimited" : "Limited"}
                  </p>
                </div>
                <div
                  className="mt-[clamp(0.585rem,1.35vw,0.75rem)] h-[clamp(0.585rem,1.35vw,0.75rem)] w-full rounded-full bg-[var(--settings-progress-track-bg)] ring-1 ring-[var(--settings-progress-track-ring)]"
                  data-oid="g8oyzf_"
                >
                  <div
                    ref={progressBarRef}
                    className={cn(
                      "storage-progress-fill h-[clamp(0.585rem,1.35vw,0.75rem)] rounded-full transition-all",
                      "bg-[var(--settings-progress-fill)]",
                      storageUsage.usage_percent >= 90 &&
                        "bg-[var(--settings-progress-fill-danger)]",
                      storageUsage.usage_percent >= 75 &&
                        storageUsage.usage_percent < 90 &&
                        "bg-[var(--settings-progress-fill-warn)]",
                    )}
                    data-oid="sly65tx"
                  />
                </div>

                {storageUsage.usage_percent >= 90 && (
                  <p
                    className="font-brand mt-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-progress-danger-text)]"
                    data-oid="cw62j27"
                  >
                    Storage quota almost full. Consider cleaning up or
                    increasing quota.
                  </p>
                )}
                {storageUsage.usage_percent >= 75 &&
                  storageUsage.usage_percent < 90 && (
                    <p
                      className="font-brand mt-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-progress-warn-text)]"
                      data-oid="z428nqx"
                    >
                      Storage usage is high. Consider regular cleanup or
                      archival.
                    </p>
                  )}
              </div>
            )}

          {storageUsage.is_unlimited && (
            <p
              className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]"
              data-oid="oxrzbxh"
            >
              Quota: unlimited
            </p>
          )}
        </div>
      ) : (
        <p
          className="font-brand text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-panel-muted)]"
          data-oid="g4dmzgq"
        >
          Loading…
        </p>
      )}
    </SettingsCard>
  );
});

export default StorageUsageSection;
