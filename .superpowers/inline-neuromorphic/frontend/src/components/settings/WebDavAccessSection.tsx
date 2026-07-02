import {
  CheckCircle2,
  Copy,
  FolderSync,
  KeyRound,
  Link2,
  MonitorSmartphone,
  PlugZap,
  Radar,
  RefreshCw,
  X,
} from "lucide-react";
import { type CSSProperties, useCallback, useMemo, useState } from "react";
import {
  useCreateWebDavWizardToken,
  useWebDavActivity,
  useWebDavDiagnostics,
} from "../../hooks/useApiTokens";
import { useClipboard } from "../../hooks/useClipboard";
import { useAuthStore } from "../../store/authStore";
import { webDavConnectionService } from "../../services/webDavConnection";
import { getErrorMessage } from "../../utils/error";
import ErrorMessage from "../common/feedback/ErrorMessage";
import SettingsCard from "./SettingsCard";
import {
  settingsInputClass,
  settingsPanelClass,
  settingsPrimaryButtonClass,
  settingsPrimaryPillClass,
  settingsSecondaryButtonClass,
} from "./settingsUi";

function webdavUrl() {
  if (typeof window === "undefined") {
    return "https://your-domain.example/dav"; // hardcoding-allow: SSR-only placeholder shown until browser origin is available
  }
  if (window.location.port === "5173" || window.location.port === "4173") {
    return `${window.location.protocol}//${window.location.hostname}:3000/dav`;
  }
  return `${window.location.origin}/dav`;
}

const setupSteps = [
  "Create a 90-day read/write WebDAV token from the wizard.",
  "Open your WebDAV client and enter the server URL.",
  "Sign in with account email plus the API Token.",
];

const clientNotes = [
  ["Finder", "Go to Server, then enter the WebDAV URL."],
  ["rclone", "Use WebDAV, vendor Other, Basic Auth."],
  ["iOS Files", "Connect to Server with the same credentials."],
  ["Note apps", "Use the shared URL for Obsidian, Joplin, or PicGo."],
];

const diagnosticRowHeight = "clamp(7.25rem,15vw,8.25rem)";
const diagnosticRowGap = "clamp(0.585rem,1.35vw,0.75rem)";
const diagnosticListStyle = {
  "--webdav-diagnostics-row-height": diagnosticRowHeight,
  "--webdav-diagnostics-list-gap": diagnosticRowGap,
  "--webdav-diagnostics-visible-rows": "5",
  "--webdav-diagnostics-list-max": `calc(${[
    diagnosticRowHeight,
    diagnosticRowHeight,
    diagnosticRowHeight,
    diagnosticRowHeight,
    diagnosticRowHeight,
    diagnosticRowGap,
    diagnosticRowGap,
    diagnosticRowGap,
    diagnosticRowGap,
  ].join(" + ")})`,
} as CSSProperties;

const diagnosticsHeaderActionClass =
  "neu-raised-green settings-neu-inset-control inline-flex min-h-[clamp(2.5rem,5.8vw,2.75rem)] w-full items-center justify-center gap-[clamp(0.2925rem,0.7vw,0.375rem)] rounded-[clamp(0.85rem,2vw,1rem)] border-0 px-[clamp(0.68rem,1.55vw,0.85rem)] py-[clamp(0.5rem,1.1vw,0.625rem)] text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-chip-text)] transition-[box-shadow,color,opacity] duration-200 active:shadow-[var(--neu-pressed-shadow)] sm:w-auto";

const diagnosticsPanelClass =
  "neu-inset settings-neu-inset-panel rounded-[clamp(1rem,2.4vw,1.25rem)] border-0 p-[clamp(1rem,2.25vw,1.25rem)] transition-[box-shadow,filter] duration-200";

const diagnosticsFieldCardClass =
  "neu-inset rounded-[clamp(0.68rem,1.55vw,0.8rem)] border-0 p-[clamp(0.68rem,1.55vw,0.85rem)]";

const diagnosticsFieldLabelClass =
  "font-brand text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-panel-label)]";

const diagnosticsFieldValueClass =
  "mt-[clamp(0.24rem,0.6vw,0.32rem)] text-[length:var(--settings-text-sm)] font-semibold leading-relaxed text-[var(--settings-panel-value)]";

const diagnosticsFieldDescriptionClass =
  "mt-[clamp(0.32rem,0.75vw,0.42rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-panel-muted)]";

const diagnosticsMetricChipClass =
  "neu-raised-green inline-flex w-fit items-center rounded-full border-0 px-[clamp(0.48rem,1.05vw,0.62rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-panel-value)]";

export default function WebDavAccessSection() {
  const url = webdavUrl();
  const userEmail = useAuthStore((state) => state.user?.email ?? "");
  const { copy } = useClipboard();
  const createWizardToken = useCreateWebDavWizardToken();
  const { data: activity = [], isLoading: activityLoading } =
    useWebDavActivity();
  const {
    data: diagnostics = [],
    isFetching: diagnosticsFetching,
    isLoading: diagnosticsLoading,
    refetch: refetchDiagnostics,
  } = useWebDavDiagnostics();
  const [createdToken, setCreatedToken] = useState<{
    id: string;
    name: string;
    token: string;
    expires_at: string | null;
    webdav_read_only: boolean;
  } | null>(null);
  const [wizardMessage, setWizardMessage] = useState<string | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [wizardTokenName, setWizardTokenName] = useState("MacBook Finder");
  const [wizardReadOnly, setWizardReadOnly] = useState(false);
  const [wizardRootFolderId, setWizardRootFolderId] = useState("");
  const [copyUrlPressed, setCopyUrlPressed] = useState(false);

  const normalizedUrl = useMemo(
    () => (url.endsWith("/") ? url : `${url}/`),
    [url],
  );

  const copyValue = useCallback(
    async (value: string, label: string) => {
      const ok = await copy(value);
      setWizardError(ok ? null : `Copy ${label} failed`);
      if (ok) setWizardMessage(`${label} copied`);
    },
    [copy],
  );

  const hideCreatedToken = useCallback(() => {
    setCreatedToken(null);
  }, []);

  const copyCreatedToken = useCallback(async () => {
    if (!createdToken) return;
    const ok = await copy(createdToken.token);
    if (ok) {
      setCreatedToken(null);
      setWizardError(null);
      setWizardMessage("Token copied. Secret hidden.");
      return;
    }
    setWizardError("Copy Token failed");
  }, [copy, createdToken]);

  const closeWizardStatus = useCallback(() => {
    setWizardMessage(null);
    setWizardError(null);
  }, []);

  const releaseCopyUrlPress = useCallback(() => {
    setCopyUrlPressed(false);
  }, []);

  const runConnectionTest = useCallback(
    async (token: string) => {
      if (!userEmail) {
        setWizardError("Connection test needs your account email.");
        return;
      }
      setTestingConnection(true);
      setWizardError(null);
      try {
        const result = await webDavConnectionService.testConnection({
          serverUrl: normalizedUrl,
          username: userEmail,
          token,
        });
        if (result.ok) {
          setWizardMessage(`Connection test passed (${result.status})`);
        } else {
          setWizardError(`Connection test failed (${result.status})`);
        }
      } catch (error) {
        setWizardError(getErrorMessage(error, "Connection test failed"));
      } finally {
        setTestingConnection(false);
      }
    },
    [normalizedUrl, userEmail],
  );

  const handleCreateWizardToken = useCallback(() => {
    setWizardError(null);
    setWizardMessage(null);
    createWizardToken.mutate(
      {
        name: wizardTokenName.trim() || "MacBook Finder",
        webdav_read_only: wizardReadOnly,
        webdav_root_folder_id: wizardRootFolderId.trim() || null,
      },
      {
        onSuccess: (response) => {
          setCreatedToken(response.token);
          setWizardMessage("WebDAV read/write token created. Copy it now.");
          void runConnectionTest(response.token.token);
        },
        onError: (error) => {
          setWizardError(
            getErrorMessage(error, "Failed to create WebDAV token"),
          );
        },
      },
    );
  }, [
    createWizardToken,
    runConnectionTest,
    wizardReadOnly,
    wizardRootFolderId,
    wizardTokenName,
  ]);

  return (
    <SettingsCard
      title="WebDAV Access"
      description="Use one endpoint and an API Token for Finder, rclone, iOS Files, and note apps."
      icon={
        <FolderSync
          className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
          aria-hidden="true"
        />
      }
    >
      <div
        data-testid="webdav-access-grid"
        className="grid items-start gap-[clamp(1rem,2.25vw,1.25rem)]"
      >
        <section
          data-testid="webdav-connection-panel"
          className={settingsPanelClass(
            "overflow-hidden p-[clamp(1rem,2.25vw,1.25rem)]",
          )}
        >
          <div
            data-testid="webdav-connection-heading-row"
            className="flex flex-col items-start gap-[clamp(1rem,2.25vw,1.25rem)] md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
                <Link2
                  className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                  aria-hidden="true"
                />
                <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                  Connection details
                </h3>
              </div>
              <p className="font-brand mt-[clamp(0.39rem,0.9vw,0.5rem)] max-w-[var(--app-copy-wide-max-width)] text-[length:var(--settings-text-sm)] leading-relaxed tracking-wide text-[var(--settings-subtitle)]">
                One WebDAV address works across desktop clients, mobile file
                apps, and sync tools.
              </p>
            </div>
            <div
              data-testid="webdav-basic-auth-mobile-slot"
              className="w-full px-[clamp(0.78rem,1.8vw,1rem)] md:w-auto md:px-0"
            >
              <span
                data-testid="webdav-basic-auth-chip"
                className={settingsPrimaryPillClass(
                  "font-brand min-h-[clamp(2.45rem,5.25vw,2.85rem)] w-full min-w-[clamp(8.75rem,12vw,9.5rem)] md:w-fit md:mr-[clamp(0.78rem,1.8vw,1rem)]",
                )}
              >
                Basic Auth
              </span>
            </div>
          </div>

          <div className="neu-inset mt-[clamp(1rem,2.25vw,1.25rem)] rounded-[clamp(0.7rem,1.6vw,0.875rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
            <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]">
              Server URL
            </p>
            <div
              data-testid="webdav-url-row"
              className="mt-[clamp(0.39rem,0.9vw,0.5rem)] flex flex-col gap-[clamp(0.585rem,1.35vw,0.75rem)] md:flex-row md:items-center md:justify-between"
            >
              <p className="min-w-0 break-all font-mono text-[length:var(--settings-text-md)] font-semibold text-[var(--settings-panel-value)]">
                {url}
              </p>
              <button
                type="button"
                className={settingsPrimaryPillClass(
                  `font-brand w-full min-w-[clamp(8.75rem,12vw,9.5rem)] gap-[clamp(0.39rem,0.9vw,0.5rem)] md:w-auto ${
                    copyUrlPressed
                      ? "webdav-copy-url-pressed scale-[0.98] translate-y-[clamp(0.04rem,0.1vw,0.0625rem)] shadow-[var(--neu-pressed-shadow)]"
                      : ""
                  }`,
                )}
                onPointerDown={() => setCopyUrlPressed(true)}
                onPointerUp={releaseCopyUrlPress}
                onPointerLeave={releaseCopyUrlPress}
                onPointerCancel={releaseCopyUrlPress}
                onClick={() => void copyValue(url, "Server URL")}
              >
                <Copy className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]" />
                Copy URL
              </button>
            </div>
          </div>

          <div className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:grid-cols-2">
            <div className="neu-inset rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
              <p className="font-brand text-[length:var(--settings-text-xs)] tracking-wide text-[var(--settings-kpi-label)]">
                Username
              </p>
              <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-kpi-value)]">
                {userEmail || "Account email"}
              </p>
              {userEmail && (
                <button
                  type="button"
                  className={settingsPrimaryPillClass(
                    "webdav-copy-username-button font-brand mt-[clamp(0.58rem,1.35vw,0.75rem)] w-full min-w-[clamp(8.75rem,12vw,9.5rem)] gap-[clamp(0.39rem,0.9vw,0.5rem)]",
                  )}
                  onClick={() => void copyValue(userEmail, "Username")}
                >
                  <Copy className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]" />
                  Copy username
                </button>
              )}
            </div>
            <div className="neu-inset rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
              <p className="font-brand text-[length:var(--settings-text-xs)] tracking-wide text-[var(--settings-kpi-label)]">
                Password
              </p>
              <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-kpi-value)]">
                API Token
              </p>
            </div>
          </div>
        </section>

        <section
          data-testid="webdav-wizard-panel"
          className={diagnosticsPanelClass}
        >
          <div
            data-testid="webdav-wizard-heading-row"
            className="flex flex-col gap-[clamp(0.78rem,1.8vw,1rem)] lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
                <PlugZap
                  className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                  aria-hidden="true"
                />
                <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                  Connection wizard
                </h3>
              </div>
              <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
                Creates a WebDAV-enabled read/write token that expires in 90
                days, then tests PROPFIND while the token is visible.
              </p>
            </div>
            <button
              type="button"
              className={settingsPrimaryButtonClass(
                "inline-flex w-full items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] xl:w-auto",
              )}
              disabled={createWizardToken.isPending || testingConnection}
              onClick={handleCreateWizardToken}
            >
              <KeyRound className="h-[clamp(0.9rem,2vw,1rem)] w-[clamp(0.9rem,2vw,1rem)]" />
              {createWizardToken.isPending
                ? "Creating"
                : "Create read/write token for 90 days"}
            </button>
          </div>

          <div className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.78rem,1.8vw,1rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <div>
              <label
                htmlFor="webdav-wizard-token-name"
                className="block text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-panel-label)]"
              >
                Device token name
              </label>
              <input
                id="webdav-wizard-token-name"
                value={wizardTokenName}
                onChange={(event) => setWizardTokenName(event.target.value)}
                className={settingsInputClass(
                  false,
                  "mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)]",
                )}
              />
            </div>
            <div>
              <label
                htmlFor="webdav-wizard-root-folder"
                className="block text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-panel-label)]"
              >
                Root folder ID
              </label>
              <input
                id="webdav-wizard-root-folder"
                value={wizardRootFolderId}
                onChange={(event) => setWizardRootFolderId(event.target.value)}
                placeholder="Full account"
                className={settingsInputClass(
                  false,
                  "mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)]",
                )}
              />
            </div>
            <label className="neu-inset group relative grid cursor-pointer grid-cols-[clamp(2.1rem,4vw,2.4rem)_minmax(0,1fr)] gap-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.7rem,1.6vw,0.875rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.85rem)] text-[var(--settings-panel-value)] lg:col-span-2">
              <input
                type="checkbox"
                checked={wizardReadOnly}
                onChange={(event) => setWizardReadOnly(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="neu-inset settings-color-checkbox-indicator mt-[clamp(0.1rem,0.25vw,0.15rem)] flex h-[clamp(1.7rem,3.2vw,1.9rem)] w-[clamp(1.7rem,3.2vw,1.9rem)] rounded-[clamp(0.55rem,1.2vw,0.65rem)] border-0"
              />
              <span className="min-w-0">
                <span className="block text-[length:var(--settings-text-sm)] font-semibold tracking-wide">
                  Create read-only token
                </span>
                <span className="mt-[clamp(0.195rem,0.45vw,0.25rem)] block text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-panel-muted)]">
                  Browse and download only; writes return 403.
                </span>
              </span>
            </label>
          </div>

          {createdToken && (
            <div className="neu-inset mt-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
              <div className="flex flex-col gap-[clamp(0.585rem,1.35vw,0.75rem)] md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-[clamp(0.5rem,1.1vw,0.625rem)]">
                    <p className="text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-panel-label)]">
                      One-time token
                    </p>
                    <button
                      type="button"
                      aria-label="Hide one-time token"
                      className="neu-raised-sm inline-flex shrink-0 items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 p-[clamp(0.3rem,0.8vw,0.375rem)] text-[var(--settings-subtitle)] transition-[box-shadow,color] hover:text-[var(--settings-panel-value)] active:shadow-[var(--neu-pressed-shadow)]"
                      onClick={hideCreatedToken}
                    >
                      <X
                        className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] break-all font-mono text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]">
                    {createdToken.token}
                  </p>
                  <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                    Read/write · expires{" "}
                    {createdToken.expires_at
                      ? new Date(createdToken.expires_at).toLocaleDateString()
                      : "never"}
                  </p>
                </div>
                <button
                  type="button"
                  className={settingsSecondaryButtonClass(
                    "inline-flex w-full items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] md:w-auto",
                  )}
                  onClick={() => void copyCreatedToken()}
                >
                  <Copy className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]" />
                  Copy token
                </button>
              </div>
            </div>
          )}

          {(wizardMessage || wizardError || testingConnection) && (
            <ErrorMessage
              message={
                testingConnection
                  ? "Testing WebDAV connection"
                  : (wizardError ?? wizardMessage ?? "")
              }
              type={wizardError ? "error" : "info"}
              onClose={closeWizardStatus}
              autoDismissMs={
                testingConnection ? undefined : wizardError ? 5000 : 3000
              }
              className="mt-[clamp(0.78rem,1.8vw,1rem)] [&_p]:text-[length:var(--settings-text-sm)]"
            />
          )}
        </section>

        <div
          data-testid="webdav-guidance-grid"
          className="grid gap-[clamp(0.78rem,1.8vw,1rem)] lg:grid-cols-3"
        >
          <section
            data-testid="webdav-credentials-panel"
            className={settingsPanelClass("h-full")}
          >
            <div className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
              <KeyRound
                className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                aria-hidden="true"
              />
              <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                Credential mapping
              </h3>
            </div>
            <p className="font-brand mt-[clamp(0.78rem,1.8vw,1rem)] text-[length:var(--settings-text-xs)] leading-relaxed tracking-wide text-[var(--settings-subtitle)]">
              Password maps to an API Token with WebDAV access enabled; account
              passwords are not accepted here.
            </p>
          </section>

          <section
            data-testid="webdav-setup-panel"
            className={settingsPanelClass("h-full")}
          >
            <div className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
              <CheckCircle2
                className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                aria-hidden="true"
              />
              <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                Setup order
              </h3>
            </div>
            <ol className="mt-[clamp(0.78rem,1.8vw,1rem)] space-y-[clamp(0.585rem,1.35vw,0.75rem)]">
              {setupSteps.map((step, index) => (
                <li
                  key={step}
                  className="grid grid-cols-[clamp(1.5rem,3vw,1.75rem)_minmax(0,1fr)] gap-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-sm)] leading-relaxed text-[var(--settings-panel-value)]"
                >
                  <span className="neu-raised-green font-brand flex h-[clamp(1.5rem,3vw,1.75rem)] w-[clamp(1.5rem,3vw,1.75rem)] items-center justify-center rounded-full border-0 text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section
            data-testid="webdav-clients-panel"
            className={settingsPanelClass("h-full")}
          >
            <div className="flex items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
              <MonitorSmartphone
                className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                aria-hidden="true"
              />
              <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                Client notes
              </h3>
            </div>
            <div className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:grid-cols-2 lg:grid-cols-1">
              {clientNotes.map(([name, detail]) => (
                <div
                  key={name}
                  className="neu-inset grid gap-[clamp(0.195rem,0.45vw,0.25rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.585rem,1.35vw,0.75rem)]"
                >
                  <p className="font-brand text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-kpi-label)]">
                    {name}
                  </p>
                  <p className="text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section
          data-testid="webdav-diagnostics-panel"
          className={diagnosticsPanelClass}
        >
          <div className="flex flex-col pb-[clamp(0.5rem,1.4vw,0.75rem)] gap-[clamp(0.78rem,1.8vw,1rem)] md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-[clamp(0.585rem,1.35vw,0.75rem)]">
              <Radar
                className="h-[clamp(0.9rem,2vw,1.1rem)] w-[clamp(0.9rem,2vw,1.1rem)] shrink-0 text-[var(--settings-chip-icon)]"
                aria-hidden="true"
              />
              <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                Device diagnostics
              </h3>
            </div>
            <div className="flex w-full flex-col gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:flex-row md:w-auto">
              <span
                data-testid="webdav-diagnostics-count-action"
                className={diagnosticsHeaderActionClass}
              >
                {diagnostics.length} token{diagnostics.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                aria-label="Refresh device diagnostics"
                disabled={diagnosticsFetching}
                className={`${diagnosticsHeaderActionClass} disabled:cursor-not-allowed disabled:opacity-60`}
                onClick={() => {
                  void refetchDiagnostics();
                }}
              >
                <RefreshCw
                  className={`h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] ${diagnosticsFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>
          </div>

          {diagnosticsLoading ? (
            <p className="mt-[clamp(0.78rem,1.8vw,1rem)] text-[length:var(--settings-text-sm)] text-[var(--settings-panel-muted)]">
              Loading WebDAV diagnostics...
            </p>
          ) : diagnostics.length === 0 ? (
            <p className="mt-[clamp(0.78rem,1.8vw,1rem)] text-[length:var(--settings-text-sm)] text-[var(--settings-panel-muted)]">
              No WebDAV device activity yet.
            </p>
          ) : (
            <div
              data-testid="webdav-diagnostics-list-viewport"
              className="py-[clamp(0.2925rem,0.7vw,0.375rem)] grid max-h-[var(--webdav-diagnostics-list-max)] gap-[var(--webdav-diagnostics-list-gap)] overflow-y-auto px-[clamp(0.2925rem,0.7vw,0.375rem)]"
              style={diagnosticListStyle}
            >
              {diagnostics.map((item) => {
                const statusBuckets = [
                  ["2xx", item.status_buckets["2xx"]],
                  ["3xx", item.status_buckets["3xx"]],
                  ["401", item.status_buckets["401"]],
                  ["403", item.status_buckets["403"]],
                  ["416", item.status_buckets["416"]],
                  ["423", item.status_buckets["423"]],
                  ["5xx", item.status_buckets["5xx"]],
                  ["Other", item.status_buckets.other],
                ];
                const accessMode = item.webdav_read_only
                  ? "Read-only"
                  : "Read/write";
                const rootScope = item.webdav_root_folder_id ?? "Full account";
                return (
                  <article
                    key={item.token_id}
                    data-testid="webdav-diagnostics-item"
                    className="neu-inset min-h-[var(--webdav-diagnostics-row-height)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]"
                  >
                    <div className="flex flex-col gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h4 className="truncate text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]">
                          {item.token_name}
                        </h4>
                      </div>
                      <span className="neu-raised-green w-fit rounded-full border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.2925rem,0.7vw,0.375rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]">
                        {accessMode}
                      </span>
                    </div>
                    <div className="mt-[clamp(0.68rem,1.55vw,0.85rem)] grid gap-[clamp(0.58rem,1.35vw,0.75rem)] md:grid-cols-2">
                      <section className={diagnosticsFieldCardClass}>
                        <p className={diagnosticsFieldLabelClass}>
                          Latest source
                        </p>
                        <p
                          className={`${diagnosticsFieldValueClass} break-all`}
                        >
                          {item.last_ip ?? "No IP yet"}
                        </p>
                        <p className="mt-[clamp(0.18rem,0.45vw,0.24rem)] break-all text-[length:var(--settings-text-xs)] text-[var(--settings-panel-value)]">
                          {item.last_user_agent ?? "No client yet"}
                        </p>
                        <p className={diagnosticsFieldDescriptionClass}>
                          Most recent IP and client fingerprint seen on this
                          token.
                        </p>
                      </section>

                      <section className={diagnosticsFieldCardClass}>
                        <p className={diagnosticsFieldLabelClass}>
                          Access mode
                        </p>
                        <p className={diagnosticsFieldValueClass}>
                          {accessMode}
                        </p>
                        <p className={diagnosticsFieldDescriptionClass}>
                          Permission profile currently assigned to this device
                          token.
                        </p>
                      </section>

                      <section className={diagnosticsFieldCardClass}>
                        <p className={diagnosticsFieldLabelClass}>
                          Request counts
                        </p>
                        <div className="mt-[clamp(0.35rem,0.8vw,0.45rem)] flex flex-wrap gap-[clamp(0.35rem,0.8vw,0.45rem)]">
                          <span className={diagnosticsMetricChipClass}>
                            Reads {item.read_count}
                          </span>
                          <span className={diagnosticsMetricChipClass}>
                            Writes {item.write_count}
                          </span>
                        </div>
                        <p className={diagnosticsFieldDescriptionClass}>
                          Read traffic versus write-capable operations observed
                          for this token.
                        </p>
                      </section>

                      <section className={diagnosticsFieldCardClass}>
                        <p className={diagnosticsFieldLabelClass}>
                          HTTP results
                        </p>
                        <div className="mt-[clamp(0.35rem,0.8vw,0.45rem)] flex flex-wrap gap-[clamp(0.35rem,0.8vw,0.45rem)]">
                          {statusBuckets.map(([bucket, count]) => (
                            <span
                              key={bucket}
                              data-testid={`webdav-status-bucket-${bucket}`}
                              className={diagnosticsMetricChipClass}
                            >
                              <span>{bucket}</span>
                              <span
                                aria-hidden="true"
                                className="mx-[clamp(0.16rem,0.42vw,0.22rem)] text-[var(--color-text-primary)]"
                              >
                                -
                              </span>
                              <span className="text-[rgba(var(--rgb-purple-400),0.96)]">
                                {count}
                              </span>
                            </span>
                          ))}
                        </div>
                        <p className={diagnosticsFieldDescriptionClass}>
                          Response buckets grouped by outcome so client issues
                          surface quickly.
                        </p>
                      </section>

                      <section
                        className={`${diagnosticsFieldCardClass} md:col-span-2`}
                      >
                        <p className={diagnosticsFieldLabelClass}>Root scope</p>
                        <p
                          className={`${diagnosticsFieldValueClass} break-all`}
                        >
                          {rootScope}
                        </p>
                        <p className={diagnosticsFieldDescriptionClass}>
                          Folder boundary this token can see when clients mount
                          the WebDAV endpoint.
                        </p>
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showActivity && (
          <section
            data-testid="webdav-activity-panel"
            className="neu-raised settings-neu-raised-card rounded-[clamp(1rem,2.4vw,1.25rem)] border-0 p-[clamp(1rem,2.25vw,1.25rem)]"
          >
            <div
              data-testid="webdav-activity-heading-row"
              className="flex flex-col items-start gap-[clamp(0.78rem,1.8vw,1rem)] md:flex-row md:justify-between"
            >
              <div className="min-w-0">
                <h3 className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
                  Recent WebDAV activity
                </h3>
                <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                  Audit WebDAV client requests, paths, status codes, and token
                  names.
                </p>
              </div>
              <div
                data-testid="webdav-activity-heading-actions"
                className="flex w-full flex-wrap items-center justify-between gap-[clamp(0.35rem,0.9vw,0.5rem)] md:ml-auto md:w-auto md:justify-end"
              >
                <span className="neu-raised-green rounded-full border-0 px-[clamp(0.45rem,1vw,0.625rem)] py-[clamp(0.18rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]">
                  {activityLoading ? "Loading" : `${activity.length} total`}
                </span>
                <button
                  type="button"
                  aria-label="Hide recent WebDAV activity"
                  className="neu-raised-red inline-flex items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 p-[clamp(0.3rem,0.8vw,0.375rem)] text-[var(--settings-subtitle)] transition-[box-shadow,color] hover:text-[var(--settings-panel-value)] active:shadow-[var(--neu-pressed-shadow)]"
                  onClick={() => setShowActivity(false)}
                >
                  <X
                    className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
            {activity.length === 0 ? (
              <p className="mt-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
                No WebDAV activity yet.
              </p>
            ) : (
              <div
                data-testid="webdav-activity-list"
                className="neu-inset settings-neu-inset-panel mt-[clamp(0.68rem,1.6vw,1rem)] grid max-h-[clamp(16rem,42dvh,24rem)] gap-[clamp(0.3rem,0.75vw,0.5rem)] overflow-y-auto rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.35rem,0.9vw,0.6rem)] [scrollbar-gutter:stable]"
              >
                {activity.map((event) => (
                  <div
                    key={event.id}
                    data-testid={`webdav-activity-row-${event.id}`}
                    className="neu-inset grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[clamp(0.55rem,1.35vw,1rem)] gap-y-[clamp(0.28rem,0.7vw,0.42rem)] rounded-[clamp(0.65rem,1.5vw,0.75rem)] border-0 p-[clamp(0.45rem,1vw,0.64rem)] text-[length:var(--settings-text-xs)] sm:grid-cols-[minmax(0,0.36fr)_minmax(0,1fr)_auto] sm:items-start sm:p-[clamp(0.58rem,1.35vw,0.75rem)]"
                  >
                    <div
                      data-testid={`webdav-activity-row-header-${event.id}`}
                      className="contents"
                    >
                      <div
                        data-testid={`webdav-activity-method-${event.id}`}
                        className="flex min-w-0 items-baseline gap-[clamp(0.34rem,0.8vw,0.5rem)] sm:col-start-1 sm:row-start-1"
                      >
                        <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase text-[var(--settings-kpi-label)]">
                          Method
                        </span>
                        <span className="min-w-0 truncate font-mono font-semibold text-[var(--settings-kpi-value)]">
                          {event.method}
                        </span>
                      </div>
                      <div
                        data-testid={`webdav-activity-status-${event.id}`}
                        className="flex min-w-0 items-baseline justify-end gap-[clamp(0.3rem,0.75vw,0.45rem)] sm:col-start-3 sm:row-start-1"
                      >
                        <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase text-[var(--settings-kpi-label)]">
                          Status
                        </span>
                        <span className="neu-raised-green rounded-full border-0 px-[clamp(0.4rem,0.9vw,0.5rem)] py-[clamp(0.1rem,0.3vw,0.125rem)] font-mono text-[var(--settings-subtitle)]">
                          {event.status_code}
                        </span>
                      </div>
                    </div>
                    <div
                      data-testid={`webdav-activity-path-${event.id}`}
                      className="col-span-2 flex min-w-0 items-baseline gap-[clamp(0.34rem,0.8vw,0.5rem)] sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    >
                      <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase text-[var(--settings-kpi-label)]">
                        Path
                      </span>
                      <span className="min-w-0 break-all font-mono text-[var(--settings-panel-value)]">
                        {event.path}
                      </span>
                    </div>
                    <div
                      data-testid={`webdav-activity-meta-${event.id}`}
                      className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-[clamp(0.55rem,1.35vw,1rem)] gap-y-[clamp(0.25rem,0.7vw,0.45rem)] text-[var(--settings-subtitle)] sm:col-span-3 sm:row-start-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div
                        data-testid={`webdav-activity-token-${event.id}`}
                        className="flex min-w-0 items-baseline gap-[clamp(0.34rem,0.8vw,0.5rem)]"
                      >
                        <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase text-[var(--settings-kpi-label)]">
                          Token
                        </span>
                        <span className="min-w-0 truncate">
                          {event.token_name ?? "WebDAV token"}
                        </span>
                      </div>
                      <div
                        data-testid={`webdav-activity-date-${event.id}`}
                        className="flex items-baseline justify-end gap-[clamp(0.3rem,0.75vw,0.45rem)]"
                      >
                        <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase text-[var(--settings-kpi-label)]">
                          Date
                        </span>
                        <span className="whitespace-nowrap">
                          {new Date(event.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </SettingsCard>
  );
}
