import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { formatBytes } from "../utils/format";
import PageLayout from "../components/layout/PageLayout";
import UserInfoSection from "../components/settings/UserInfoSection";
import StorageUsageSection from "../components/settings/StorageUsageSection";
import PasswordChangeSection from "../components/settings/PasswordChangeSection";
import ApiTokenSection from "../components/settings/ApiTokenSection";
import WebDavAccessSection from "../components/settings/WebDavAccessSection";
import OcrStatusSection from "../components/settings/OcrStatusSection";
import { Settings2, ArrowLeft } from "lucide-react";
import { useStorageUsage } from "../hooks/useStorageUsage";
import { useApiTokens } from "../hooks/useApiTokens";
import {
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "../components/settings/settingsUi";
import { resolveSettingsReturnTarget } from "../utils/settingsReturnTarget";

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: storageUsage } = useStorageUsage();
  const { data: apiTokens = [] } = useApiTokens();

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const handleBack = useCallback(() => {
    navigate(resolveSettingsReturnTarget(), { replace: true });
  }, [navigate]);

  return (
    <PageLayout
      title="SETTINGS"
      username={user?.username}
      onLogout={handleLogout}
      data-oid="nr697ev"
    >
      {/* Match NavBar width so the logo aligns with page content */}
      <div
        className="mx-auto w-full max-w-[var(--app-shell-max-width)] min-w-0 text-[length:var(--settings-text-md)]"
        data-testid="settings-page-shell"
        data-oid="ke2.spo"
      >
        {/* Page header */}
        <div
          data-testid="settings-hero-panel"
          className="neu-raised settings-neu-raised-card relative isolate mb-[clamp(1.25rem,2.7vw,1.5rem)] overflow-hidden rounded-[clamp(1.25rem,3vw,1.5rem)] border-0 p-[clamp(1rem,2.25vw,1.25rem)] transition-[box-shadow] duration-300 sm:p-[clamp(1.25rem,2.7vw,1.5rem)]"
          data-oid="8u-ne0x"
        >
          <div
            className="relative z-10 flex flex-col gap-[clamp(0.78rem,1.8vw,1rem)] lg:flex-row lg:items-center lg:justify-between"
            data-testid="settings-hero-layout"
            data-oid="5hj.--8"
          >
            <div className="min-w-0" data-oid="tc3yanx">
              <button
                type="button"
                onClick={handleBack}
                className={settingsSecondaryButtonClass(
                  "mb-[clamp(0.78rem,1.8vw,1rem)] inline-flex items-center px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-chip-text)]",
                )}
                data-oid="li-ft82"
              >
                <ArrowLeft
                  className="mr-[clamp(0.39rem,0.9vw,0.5rem)] h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                  aria-hidden="true"
                  data-oid="mf5bp9k"
                />
                Back
              </button>
              <div
                className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]"
                data-oid="lvlcydi"
              >
                <button
                  type="button"
                  aria-label="Go to files home"
                  onClick={() => navigate("/files")}
                  className={settingsSecondaryButtonClass(
                    "p-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--settings-chip-icon)] focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)]",
                  )}
                  data-oid="06je80s"
                >
                  <Settings2
                    className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
                    aria-hidden="true"
                    data-oid="6q_g5bq"
                  />
                </button>
                <h1
                  className="font-brand truncate text-[length:var(--settings-text-xl)] font-normal tracking-widest text-[var(--settings-title)]"
                  data-oid=":ph..cd"
                >
                  Settings Center
                </h1>
              </div>
              <p
                className="font-brand mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)] font-normal tracking-wide text-[var(--settings-subtitle)]"
                data-oid="59c-6-q"
              >
                Account info, storage quota, security & token management.
              </p>
            </div>

            <div
              className="grid w-full grid-cols-[repeat(auto-fit,minmax(var(--settings-hero-summary-tile-min),1fr))] gap-[clamp(0.585rem,1.35vw,0.75rem)] lg:w-[var(--settings-hero-summary-inline-size)]"
              data-testid="settings-hero-summary-grid"
              data-oid="duty7hg"
            >
              <div
                className="neu-raised-green settings-neu-stat-tile rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.585rem,1.35vw,0.75rem)]"
                data-oid="u.f.93l"
              >
                <p
                  className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide"
                  data-oid="a3v:fob"
                >
                  Files
                </p>
                <p
                  className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-semibold tabular-nums"
                  data-oid="xi:vm2r"
                >
                  {storageUsage ? storageUsage.file_count : "-"}
                </p>
              </div>
              <div
                className="neu-raised-green settings-neu-stat-tile rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.585rem,1.35vw,0.75rem)]"
                data-oid="oj887ag"
              >
                <p
                  className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide "
                  data-oid="i.vmzng"
                >
                  Usage
                </p>
                <p
                  className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-semibold tabular-nums"
                  data-oid="0mw84c0"
                >
                  {storageUsage ? formatBytes(storageUsage.total_size) : "-"}
                </p>
              </div>
              <div
                className="neu-raised-green settings-neu-stat-tile hidden rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.585rem,1.35vw,0.75rem)] sm:block"
                data-oid="66o_98f"
              >
                <p
                  className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide "
                  data-oid="75dwf9p"
                >
                  Tokens
                </p>
                <p
                  className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-semibold tabular-nums"
                  data-oid="wij1zkh"
                >
                  {apiTokens.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          data-testid="settings-card-grid"
          className="grid gap-[clamp(1.35rem,3vw,1.75rem)]"
          data-oid="g884a9r"
        >
          <div
            data-testid="settings-group-identity"
            className="grid gap-[clamp(1.25rem,2.7vw,1.5rem)] xl:grid-cols-2 xl:items-stretch"
          >
            <div
              data-testid="settings-account-column"
              className="min-w-0 h-full [&>section]:h-full [&>section]:flex [&>section]:flex-col [&>section>div:last-child]:flex [&>section>div:last-child]:flex-1 [&>section>div:last-child]:flex-col [&>section>div:last-child>form]:flex [&>section>div:last-child>form]:flex-1 [&>section>div:last-child>form]:flex-col"
            >
              <UserInfoSection data-oid="1jpbmmd" />
            </div>
            <div
              data-testid="settings-security-column"
              className="min-w-0 h-full [&>section]:h-full [&>section]:flex [&>section]:flex-col [&>section>div:last-child]:flex [&>section>div:last-child]:flex-1 [&>section>div:last-child]:flex-col [&>section>div:last-child>form]:flex [&>section>div:last-child>form]:flex-1 [&>section>div:last-child>form]:flex-col"
            >
              <PasswordChangeSection data-oid="0py-1mt" />
            </div>
          </div>

          <div
            data-testid="settings-group-webdav-focus"
            className="min-w-0 xl:[&>section]:p-[clamp(1.35rem,2.8vw,1.75rem)]"
          >
            <WebDavAccessSection />
            <div className="neu-raised-sm mt-[clamp(0.78rem,1.8vw,1rem)] flex flex-col gap-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.7rem,1.6vw,0.875rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)] lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--settings-title)]">
                  Share Center
                </p>
                <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                  Manage share links and upload-only File Requests.
                </p>
              </div>
              <div
                data-testid="settings-share-center-actions"
                className="flex w-full md:justify-end lg:w-auto"
              >
                <button
                  type="button"
                  onClick={() => navigate("/shares")}
                  className={settingsPrimaryButtonClass("w-full md:w-auto")}
                >
                  Manage Shares
                </button>
              </div>
            </div>
          </div>

          <div
            data-testid="settings-group-token-workspace"
            className="min-w-0 xl:[&>section]:p-[clamp(1.35rem,2.8vw,1.75rem)]"
          >
            <ApiTokenSection data-oid="y70j20v" />
          </div>

          <div
            data-testid="settings-group-status"
            className="grid gap-[clamp(1.25rem,2.7vw,1.5rem)] lg:grid-cols-2 lg:items-stretch"
          >
            <div
              data-testid="settings-ocr-column"
              className="min-w-0 h-full [&>section]:h-full"
            >
              <OcrStatusSection />
            </div>
            <div
              data-testid="settings-storage-column"
              className="min-w-0 h-full [&>section]:h-full"
            >
              <StorageUsageSection data-oid="jcf9:wl" />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
