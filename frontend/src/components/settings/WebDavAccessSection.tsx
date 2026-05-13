import { FolderSync } from "lucide-react";
import { useTranslation } from "react-i18next";
import SettingsCard from "./SettingsCard";

function webdavUrl() {
  if (typeof window === "undefined") {
    return "https://your-domain.example/dav";
  }
  return `${window.location.origin}/dav`;
}

export default function WebDavAccessSection() {
  const { t } = useTranslation();
  const url = webdavUrl();

  return (
    <SettingsCard
      title={t("settings.webdavAccess.title")}
      description={t("settings.webdavAccess.description")}
      icon={<FolderSync className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]" aria-hidden="true" />}
    >
      <div className="grid gap-[clamp(0.78rem,1.8vw,1rem)] md:grid-cols-2">
        <div className="rounded-[clamp(0.6rem,1.4vw,0.75rem)] border border-[var(--settings-kpi-border)] bg-[var(--settings-kpi-bg)] p-[clamp(0.78rem,1.8vw,1rem)]">
          <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-kpi-label)]">
            {t("settings.webdavAccess.serverUrl")}
          </p>
          <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] break-all font-mono text-[length:var(--settings-text-sm)] text-[var(--settings-kpi-value)]">
            {url}
          </p>
        </div>
        <div className="rounded-[clamp(0.6rem,1.4vw,0.75rem)] border border-[var(--settings-kpi-border)] bg-[var(--settings-kpi-bg)] p-[clamp(0.78rem,1.8vw,1rem)]">
          <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-kpi-label)]">
            {t("settings.webdavAccess.credentials")}
          </p>
          <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)] leading-relaxed text-[var(--settings-kpi-value)]">
            {t("settings.webdavAccess.credentialsDescription")}
          </p>
        </div>
      </div>
      <div className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-sm)] text-[var(--settings-subtitle)] sm:grid-cols-2">
        <p>macOS Finder: Connect to Server, then enter {url}.</p>
        <p>rclone: choose WebDAV, vendor Other, then use the same URL and token.</p>
        <p>iOS Files: Connect to Server with Basic Auth.</p>
        <p>Obsidian, Joplin, and PicGo use the same WebDAV URL and API Token.</p>
      </div>
    </SettingsCard>
  );
}
