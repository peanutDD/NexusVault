import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OcrStatusSection from "./OcrStatusSection";
import { useOcrStatus } from "../../hooks/useOcrStatus";

vi.mock("../../hooks/useOcrStatus", () => ({
  useOcrStatus: vi.fn(),
}));

const copyMock = vi.fn();

vi.mock("../../hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: copyMock }),
}));

describe("OcrStatusSection", () => {
  beforeEach(() => {
    copyMock.mockReset();
    copyMock.mockResolvedValue(true);
  });

  it("shows OCR runtime readiness and PDF page limit", () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: true,
        pdf_max_pages: 8,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: false,
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByText("OCR Status")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Tesseract")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Poppler")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("8 pages")).toBeInTheDocument();
    expect(screen.getByText(/Install Poppler/i)).toBeInTheDocument();
    expect(screen.getByText(/OCR is active/i)).toBeInTheDocument();
  });

  it("shows disabled OCR guidance when extraction is turned off", () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: false,
        pdf_max_pages: 5,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: true,
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(
      screen.getByText(/OCR should be enabled by default/i),
    ).toBeInTheDocument();
  });

  it("lets the user refresh the OCR runtime status", async () => {
    const refetch = vi.fn();
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: true,
        pdf_max_pages: 5,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: true,
        },
      },
      isLoading: false,
      isFetching: false,
      refetch,
      dataUpdatedAt: new Date("2026-05-21T08:30:00Z").getTime(),
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
    const refreshRow = screen.getByTestId("ocr-status-refresh-row");
    const statusGrid = screen.getByTestId("ocr-status-grid");
    const refreshButton = screen.getByRole("button", {
      name: /Refresh OCR Status/i,
    });
    const refreshSlot = refreshButton.parentElement;

    expect(refreshRow).toHaveClass(
      "ocrStatusRefreshRow",
      "md:grid-cols-4",
      "md:items-stretch",
    );
    expect(statusGrid).toHaveClass("md:grid-cols-4");
    expect(refreshSlot).toHaveClass(
      "ocrRefreshStatusSlot",
      "w-full",
      "md:col-start-4",
    );
    expect(refreshSlot).toHaveClass("[container-type:inline-size]");
    expect(refreshButton).toHaveTextContent("Refresh");
    expect(refreshButton).toHaveClass("w-full");
    expect(refreshButton).not.toHaveClass("[container-type:inline-size]");
    expect(refreshButton).not.toHaveClass("overflow-hidden");
    expect(refreshButton).toHaveClass(
      "ocrRefreshStatusButton",
      "ocrStatusFlatButton",
      "ocrStatusFlatButton--green",
      "whitespace-nowrap",
    );
    expect(refreshButton).toHaveClass("gap-[clamp(0.39rem,0.9vw,0.5rem)]");
    expect(refreshButton).not.toHaveClass("md:w-auto");
    const refreshLabel = screen.getByText("Refresh");
    expect(refreshLabel).toHaveClass("ocrRefreshStatusLabel", "shrink-0");
    expect(refreshLabel).not.toHaveClass("min-w-0", "overflow-hidden");
    expect(refreshButton).toHaveClass("settings-neu-primary-button");
    expect(refreshButton).toHaveClass("neu-raised-green");
    expect(refreshButton).not.toHaveClass("neu-raised-sm", "shadow-none");
    expect(refreshButton).not.toHaveClass("settings-neu-raised-button");
    expect(refreshButton).not.toHaveClass(
      "h-[3rem]",
      "min-h-[3rem]",
      "w-[12rem]",
      "min-w-[12rem]",
    );

    await userEvent.click(refreshButton);

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("defines OCR refresh button typography in container-driven CSS", () => {
    const source = readFileSync(
      resolve(__dirname, "../../styles/base.css"),
      "utf8",
    );

    expect(source).toContain(".ocrRefreshStatusSlot .ocrRefreshStatusButton");
    expect(source).toContain("font-size: clamp(0.52rem, 7.4cqi, 0.88rem);");
    expect(source).toContain("height: clamp(0.5rem, 6.8cqi, 0.95rem);");
    expect(source).toContain("width: clamp(0.5rem, 6.8cqi, 0.95rem);");
  });

  it("flattens OCR status tiles and wraps long binary paths inside each tile", () => {
    const tesseractPath =
      "/opt/homebrew/bin/tesseract-with-a-very-long-runtime-path";
    const popplerPath =
      "/opt/homebrew/bin/pdftoppm-with-a-very-long-runtime-path";
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: false,
        pdf_max_pages: 5,
        tesseract: {
          bin: tesseractPath,
          available: true,
        },
        poppler: {
          bin: popplerPath,
          available: true,
        },
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    const tesseractTile = screen.getByTestId("ocr-status-tile-tesseract");
    const popplerTile = screen.getByTestId("ocr-status-tile-poppler");
    const tesseractDetail = screen.getByText(tesseractPath);
    const popplerDetail = screen.getByText(popplerPath);
    const source = readFileSync(
      resolve(__dirname, "../../styles/base.css"),
      "utf8",
    );

    expect(tesseractTile).toHaveClass("ocrStatusFlatTile");
    expect(popplerTile).toHaveClass("ocrStatusFlatTile");
    expect(tesseractTile).not.toHaveClass("shadow-[var(--settings-kpi-shadow)]");
    expect(popplerTile).not.toHaveClass("shadow-[var(--settings-kpi-shadow)]");
    expect(tesseractDetail).toHaveClass(
      "ocrStatusTileDetail",
      "whitespace-normal",
      "break-words",
    );
    expect(popplerDetail).toHaveClass(
      "ocrStatusTileDetail",
      "whitespace-normal",
      "break-words",
    );
    expect(tesseractDetail).not.toHaveClass(
      "whitespace-nowrap",
      "truncate",
      "overflow-hidden",
    );
    expect(source).toContain(".ocrStatusFlatTile");
    const tileRule =
      source.match(/\.ocrStatusFlatTile\s*\{[^}]*\}/)?.[0] ?? "";
    expect(source.toLowerCase()).toContain("--flat-reference-green-surface-bg: #10b981;");
    expect(tileRule).toContain(
      "background: var(--flat-reference-green-surface-bg) !important;",
    );
    expect(source).toContain(".ocrStatusFlatButton--green");
    expect(source).toContain("box-shadow: none !important;");
    expect(source).toContain(".ocrStatusTileDetail");
    expect(source).toContain("overflow-wrap: anywhere;");
  });

  it("keeps refresh button sizing in CSS instead of JS inline pixel styles", () => {
    const source = readFileSync(resolve(__dirname, "./OcrStatusSection.tsx"), "utf8");

    expect(source).not.toContain("resolveRefreshButtonScale");
    expect(source).not.toContain("fontSize: `${");
    expect(source).not.toContain("width: `${");
    expect(source).not.toContain("height: `${");
  });

  it("shows concrete OCR enablement instructions and copies env config", async () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: false,
        pdf_max_pages: 5,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: true,
        },
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByText("How to enable OCR")).toBeInTheDocument();
    expect(screen.getByText(/backend runtime default/i)).toBeInTheDocument();
    expect(screen.getAllByText(/OCR_ENABLED=true/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/brew install tesseract poppler/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/restart backend and worker/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/OCR is enabled by default/i),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Copy OCR env/i }),
    );

    expect(copyMock).toHaveBeenCalledWith(
      expect.stringContaining("OCR_ENABLED=true"),
    );
    expect(await screen.findByText("OCR env copied")).toBeInTheDocument();
  });

  it("keeps OCR enablement controls and command snippets mobile-safe", () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: false,
        pdf_max_pages: 5,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: true,
        },
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByTestId("ocr-enable-heading-row")).toHaveClass(
      "flex-col",
      "items-stretch",
      "lg:flex-row",
    );
    expect(screen.getByRole("button", { name: /Copy OCR env/i })).toHaveClass(
      "w-full",
      "lg:w-auto",
    );
    expect(screen.getByRole("button", { name: /Copy OCR env/i })).toHaveClass(
      "settings-neu-primary-button",
    );
    expect(
      screen.getByRole("button", { name: /Copy OCR env/i }),
    ).not.toHaveClass(
      "settings-neu-raised-button",
      "h-[3rem]",
      "min-h-[3rem]",
      "w-[12rem]",
      "min-w-[12rem]",
    );
    expect(screen.getByTestId("ocr-local-dependencies-command")).toHaveClass(
      "break-all",
    );
    expect(screen.getByTestId("ocr-env-block")).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
    );
  });

  it("shows refreshing state while OCR status is being fetched", () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: true,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(
      screen.getByRole("button", { name: /Refreshing OCR status/i }),
    ).toBeDisabled();
    expect(screen.getByText("Refreshing")).toBeInTheDocument();
  });

  it("keeps OCR status labels stable while allowing binary paths to wrap", () => {
    vi.mocked(useOcrStatus).mockReturnValue({
      data: {
        enabled: false,
        pdf_max_pages: 5,
        tesseract: {
          bin: "tesseract",
          available: true,
        },
        poppler: {
          bin: "pdftoppm",
          available: false,
        },
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    } as unknown as ReturnType<typeof useOcrStatus>);

    render(<OcrStatusSection />);

    expect(screen.getByTestId("ocr-status-tile-pdf-ocr-limits")).toHaveClass(
      "ocrStatusTile",
      "[container-type:inline-size]",
    );
    expect(screen.getByText("PDF OCR Limits")).toHaveClass(
      "ocrStatusTileLabel",
      "whitespace-nowrap",
    );
    expect(screen.getByText("5 pages")).toHaveClass(
      "ocrStatusTileValue",
      "whitespace-nowrap",
    );
    expect(screen.getByText("pdftoppm")).toHaveClass(
      "ocrStatusTileDetail",
      "whitespace-normal",
      "break-words",
    );
    expect(screen.getByText("pdftoppm")).not.toHaveClass(
      "truncate",
      "whitespace-nowrap",
      "overflow-hidden",
    );
  });
});
