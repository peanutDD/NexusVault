import { Copy, RefreshCw, ScanText } from "lucide-react";
import { useCallback, useState } from "react";
import { useOcrStatus } from "../../hooks/useOcrStatus";
import { useClipboard } from "../../hooks/useClipboard";
import SettingsCard from "./SettingsCard";
import { settingsPanelClass, settingsPrimaryButtonClass } from "./settingsUi";

const ocrEnvConfig = [
  "OCR_ENABLED=true",
  "OCR_TESSERACT_BIN=tesseract",
  "OCR_PDFTOPPM_BIN=pdftoppm",
  "OCR_PDF_MAX_PAGES=5",
].join("\n");

function readinessLabel(available: boolean) {
  return available ? "Ready" : "Missing";
}

function readinessClass(available: boolean) {
  return available
    ? "text-[var(--settings-kpi-value)]"
    : "text-[var(--settings-danger-icon-text)]";
}

export default function OcrStatusSection() {
  const { data, dataUpdatedAt, isFetching, isLoading, refetch } =
    useOcrStatus();
  const { copy } = useClipboard();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const enabledLabel = data?.enabled ? "Enabled" : "Disabled";
  const tesseractReady = Boolean(data?.tesseract.available);
  const popplerReady = Boolean(data?.poppler.available);
  const checkedLabel =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not checked yet";
  const guidance = buildGuidance({
    enabled: Boolean(data?.enabled),
    tesseractReady,
    popplerReady,
  });
  const copyOcrEnv = useCallback(async () => {
    const copied = await copy(ocrEnvConfig);
    setCopyMessage(copied ? "OCR env copied" : "Copy OCR env failed");
  }, [copy]);

  return (
    <SettingsCard
      title="OCR Status"
      description="Runtime readiness for image and scanned PDF content extraction."
      icon={
        <ScanText
          className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]"
          aria-hidden="true"
        />
      }
    >
      <div
        data-testid="ocr-status-refresh-row"
        className="ocrStatusRefreshRow mb-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.585rem,1.35vw,0.75rem)] md:grid-cols-4 md:items-stretch"
      >
        <p className="font-brand flex min-w-0 items-center text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-section-subtitle)] md:col-span-3">
          Last checked: {checkedLabel}
        </p>
        <div className="ocrRefreshStatusSlot [container-type:inline-size] w-full md:col-start-4">
          <button
            type="button"
            className={settingsPrimaryButtonClass(
              "ocrRefreshStatusButton ocrStatusFlatButton ocrStatusFlatButton--green inline-flex w-full items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] whitespace-nowrap hover:translate-y-0 active:translate-y-0",
            )}
            disabled={isFetching}
            aria-label={
              isFetching ? "Refreshing OCR Status" : "Refresh OCR Status"
            }
            onClick={() => void refetch()}
          >
            <RefreshCw
              className={`shrink-0 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="ocrRefreshStatusLabel shrink-0">
              {isFetching ? "Refreshing" : "Refresh"}
            </span>
          </button>
        </div>
      </div>
      <div
        data-testid="ocr-status-grid"
        className="grid gap-[clamp(0.78rem,1.8vw,1rem)] md:grid-cols-4"
      >
        <StatusTile label="OCR" value={isLoading ? "Checking" : enabledLabel} />
        <StatusTile
          testId="ocr-status-tile-tesseract"
          label="Tesseract"
          value={isLoading ? "Checking" : readinessLabel(tesseractReady)}
          valueClassName={readinessClass(tesseractReady)}
          detail={data?.tesseract.bin}
        />
        <StatusTile
          testId="ocr-status-tile-poppler"
          label="Poppler"
          value={isLoading ? "Checking" : readinessLabel(popplerReady)}
          valueClassName={readinessClass(popplerReady)}
          detail={data?.poppler.bin}
        />
        <StatusTile
          testId="ocr-status-tile-pdf-ocr-limits"
          label="PDF OCR Limits"
          value={isLoading ? "Checking" : `${data?.pdf_max_pages ?? 0} pages`}
        />
      </div>
      {!isLoading && (
        <div
          className={settingsPanelClass(
            "mt-[clamp(0.78rem,1.8vw,1rem)] p-[clamp(0.78rem,1.8vw,1rem)]",
          )}
        >
          <p className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
            {guidance.title}
          </p>
          <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
            {guidance.detail}
          </p>
        </div>
      )}
      <div
        className={settingsPanelClass(
          "mt-[clamp(0.78rem,1.8vw,1rem)] p-[clamp(0.78rem,1.8vw,1rem)]",
        )}
      >
        <div
          data-testid="ocr-enable-heading-row"
          className="flex flex-col items-stretch gap-[clamp(0.78rem,1.8vw,1rem)] lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="min-w-0">
            <p className="font-brand text-[length:var(--settings-text-sm)] font-semibold tracking-wide text-[var(--settings-title)]">
              How to enable OCR
            </p>
            <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
              OCR is a backend runtime setting, not an account-level switch.
              Change the backend environment, restart backend and worker, then
              use Refresh here.
            </p>
          </div>
          <button
            type="button"
            className={settingsPrimaryButtonClass(
              "ocrStatusFlatButton inline-flex w-full shrink-0 items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] shadow-none hover:translate-y-0 active:translate-y-0 active:shadow-none lg:w-auto",
            )}
            onClick={() => void copyOcrEnv()}
          >
            <Copy className="h-[clamp(0.85rem,1.8vw,1rem)] w-[clamp(0.85rem,1.8vw,1rem)]" />
            Copy OCR env
          </button>
        </div>
        <div className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.585rem,1.35vw,0.75rem)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="neu-inset rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
            <p className="font-brand text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-kpi-label)]">
              Backend runtime default
            </p>
            <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-kpi-value)]">
              OCR_ENABLED=true
            </p>
            <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
              OCR is enabled by default. Keep this in backend/.env if you
              override search settings locally, and make sure nothing sets
              OCR_ENABLED=false. Docker Compose also includes the runtime
              packages.
            </p>
          </div>
          <div className="neu-inset rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]">
            <p className="font-brand text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-[var(--settings-kpi-label)]">
              Local dependencies
            </p>
            <p
              data-testid="ocr-local-dependencies-command"
              className="mt-[clamp(0.39rem,0.9vw,0.5rem)] break-all font-mono text-[length:var(--settings-text-xs)] text-[var(--settings-panel-value)]"
            >
              brew install tesseract poppler
            </p>
            <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
              Tesseract handles image text. Poppler provides pdftoppm for
              scanned PDF pages.
            </p>
          </div>
        </div>
        <pre
          data-testid="ocr-env-block"
          className="neu-inset mt-[clamp(0.78rem,1.8vw,1rem)] max-w-full overflow-x-auto rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-panel-value)]"
        >
          <code>{ocrEnvConfig}</code>
        </pre>
        <ol className="mt-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)] leading-relaxed text-[var(--settings-subtitle)]">
          <li>1. Install Tesseract and Poppler on the backend host.</li>
          <li>
            2. Keep the OCR env block in backend/.env if you override search
            settings locally.
          </li>
          <li>3. Restart backend and worker.</li>
          <li>
            4. Upload or reindex files so OCR text enters the search index.
          </li>
        </ol>
        {copyMessage && (
          <p className="mt-[clamp(0.585rem,1.35vw,0.75rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]">
            {copyMessage}
          </p>
        )}
      </div>
    </SettingsCard>
  );
}

function buildGuidance({
  enabled,
  tesseractReady,
  popplerReady,
}: {
  enabled: boolean;
  tesseractReady: boolean;
  popplerReady: boolean;
}) {
  if (!enabled) {
    return {
      title: "OCR is disabled",
      detail:
        "OCR should be enabled by default. If this host still reports disabled, set OCR_ENABLED=true in backend/.env or remove any OCR_ENABLED=false override, then restart backend and worker.",
    };
  }
  if (!tesseractReady && !popplerReady) {
    return {
      title: "Install OCR dependencies",
      detail:
        "Install Tesseract for image OCR and Poppler for scanned PDF page extraction, then restart the backend worker.",
    };
  }
  if (!tesseractReady) {
    return {
      title: "Install Tesseract",
      detail:
        "OCR is active, but image text extraction needs the tesseract binary available on PATH.",
    };
  }
  if (!popplerReady) {
    return {
      title: "Install Poppler",
      detail:
        "OCR is active, but scanned PDF extraction needs pdftoppm from Poppler available on PATH.",
    };
  }
  return {
    title: "OCR is active",
    detail:
      "Images and scanned PDF pages can be extracted into the search index by the background worker.",
  };
}

function StatusTile({
  testId,
  label,
  value,
  detail,
  valueClassName,
}: {
  testId?: string;
  label: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="neu-inset ocrStatusTile ocrStatusFlatTile min-w-0 [container-type:inline-size] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border-0 p-[clamp(0.78rem,1.8vw,1rem)]"
    >
      <p className="ocrStatusTileLabel font-brand overflow-visible whitespace-nowrap text-[clamp(0.4rem,6.2cqi,0.68rem)] font-normal leading-none tracking-wide text-[var(--settings-kpi-label)]">
        {label}
      </p>
      <p
        className={`ocrStatusTileValue mt-[clamp(0.39rem,0.9vw,0.5rem)] overflow-visible whitespace-nowrap text-[clamp(0.72rem,10.2cqi,1.05rem)] font-semibold leading-none text-[var(--settings-kpi-value)] ${valueClassName ?? ""}`}
      >
        {value}
      </p>
      {detail && (
        <p className="ocrStatusTileDetail mt-[clamp(0.195rem,0.45vw,0.25rem)] min-w-0 whitespace-normal break-words font-mono text-[clamp(0.48rem,6.8cqi,0.76rem)] leading-[1.25] text-[var(--settings-subtitle)]">
          {detail}
        </p>
      )}
    </div>
  );
}
