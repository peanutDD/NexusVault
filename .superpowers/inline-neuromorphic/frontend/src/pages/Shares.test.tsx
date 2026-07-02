import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Shares from "./Shares";
import { shareService } from "../services/shares";
import { fileRequestService } from "../services/fileRequests";
import { folderService } from "../services/folders";
import { useAuthStore } from "../store/authStore";

vi.mock("../components/layout/PageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-layout">{children}</main>
  ),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../services/shares", () => ({
  shareService: {
    listManagedShares: vi.fn(),
    listShareEvents: vi.fn(),
    deleteShare: vi.fn(),
  },
}));

vi.mock("../services/fileRequests", () => ({
  fileRequestService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    uploads: vi.fn(),
    inbox: vi.fn(),
    reviewUpload: vi.fn(),
    previewUploadUrl: vi.fn((id: string) => `/api/file-requests/uploads/${id}/preview`),
    previewApprovedFileUrl: vi.fn((id: string) => `/api/files/${id}/preview`),
  },
}));

vi.mock("../services/folders", () => ({
  folderService: {
    list: vi.fn(),
  },
}));

function renderShares() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/shares"]}>
        <Shares />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "http://localhost:5173" },
  });
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: { id: "user-1", username: "alice" },
      clearAuth: vi.fn(),
    } as never),
  );
  vi.mocked(shareService.listManagedShares).mockResolvedValue([
    {
      id: "share-1",
      file_id: "file-1",
      filename: "brief.md",
      share_token: "share-token",
      expires_at: null,
      max_downloads: null,
      download_count: 2,
      access_count: 5,
      has_password: true,
      status: "active",
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    },
    {
      id: "share-2",
      file_id: "file-2",
      filename: "client-deck.pdf",
      share_token: "share-token-2",
      expires_at: "2026-06-21T00:00:00Z",
      max_downloads: 10,
      download_count: 1,
      access_count: 3,
      has_password: false,
      status: "limited",
      created_at: "2026-05-21T01:00:00Z",
      updated_at: "2026-05-21T01:00:00Z",
    },
  ]);
  vi.mocked(shareService.listShareEvents).mockResolvedValue([
    {
      id: "event-1",
      share_id: "share-1",
      event_type: "access",
      status: "ok",
      created_at: "2026-05-21T08:00:00Z",
    },
  ]);
  vi.mocked(fileRequestService.list).mockResolvedValue([
    {
      id: "request-1",
      folder_id: "folder-default",
      folder_name: "Client Drop",
      title: "Client upload",
      description: null,
      allowed_mime_prefixes: [],
      max_file_size: 1024,
      max_uploads: null,
      upload_count: 1,
      expires_at: null,
      revoked_at: null,
      token_prefix: "abc123",
      public_url: null,
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    },
  ]);
  vi.mocked(fileRequestService.uploads).mockResolvedValue([
    {
      id: "upload-1",
      request_id: "request-1",
      file_id: "file-2",
      filename: "contract.pdf",
      file_size: 2048,
      mime_type: "application/pdf",
      status: "stored",
      scan_status: "not_scanned",
      created_at: "2026-05-21T09:00:00Z",
    },
  ]);
  vi.mocked(fileRequestService.inbox).mockResolvedValue({
    submissions: [
      {
        id: "submission-1",
        request_id: "request-1",
        submitter_email: "client@example.com",
        submitter_note: "Signed contract",
        file_count: 1,
        created_at: "2026-05-21T09:00:00Z",
        uploads: [
          {
            id: "upload-1",
            request_id: "request-1",
            submission_id: "submission-1",
            file_id: "file-2",
            filename: "contract.pdf",
            file_size: 2048,
            mime_type: "application/pdf",
            status: "pending",
            scan_status: "not_scanned",
            folder_id: "folder-default",
            folder_name: "Client Drop",
            created_at: "2026-05-21T09:00:00Z",
          },
        ],
        request_title: "Client upload",
        request_folder_id: "folder-default",
        request_folder_name: "Client Drop",
      },
    ],
    next_cursor: null,
  });
  vi.mocked(fileRequestService.reviewUpload).mockResolvedValue({
    id: "upload-1",
    request_id: "request-1",
    submission_id: "submission-1",
    file_id: "file-2",
    filename: "contract.pdf",
    file_size: 2048,
    mime_type: "application/pdf",
    status: "approved",
    scan_status: "not_scanned",
    folder_id: "folder-reviewed",
    folder_name: "Reviewed Assets",
    created_at: "2026-05-21T09:00:00Z",
  });
  vi.mocked(folderService.list).mockImplementation(async (parentId?: string | null) => {
    if (parentId === "folder-reviewed") {
      return [
        {
          id: "folder-nested",
          name: "Nested",
          parent_id: "folder-reviewed",
          created_at: "2026-05-21T00:00:00Z",
          updated_at: "2026-05-21T00:00:00Z",
        },
      ];
    }
    return [
      {
        id: "folder-default",
        name: "Client Drop",
        parent_id: null,
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
      },
      {
        id: "folder-reviewed",
        name: "Reviewed Assets",
        parent_id: null,
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
      },
    ];
  });
});

describe("Shares page", () => {
  it("renders the share center in bounded neuromorphic panels and exposes share events", async () => {
    renderShares();

    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    expect(screen.getByTestId("share-center-frame")).toHaveClass(
      "neu-inset",
      "settings-neu-inset-panel",
      "shareCenterCodepenFrame",
      "border-0",
    );
    const shell = screen.getByTestId("share-center-shell");

    expect(shell).toHaveClass("settings-neu-raised-card", "shareCenterCodepenShell");
    expect(shell).not.toHaveClass("border", "border-[var(--settings-surface-border)]");
    expect(screen.getByTestId("share-center-heading-row")).toHaveClass(
      "md:items-start",
      "md:justify-between",
    );
    const tabSwitcher = screen.getByTestId("share-tab-switcher");
    const sharesTab = within(tabSwitcher).getByRole("button", { name: /^Shares$/i });
    const requestsTab = within(tabSwitcher).getByRole("button", { name: /^File Requests$/i });
    const activePill = within(tabSwitcher).getByTestId("share-tab-active-pill");
    const baseCssRaw = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");
    const baseCss = baseCssRaw.replace(/\s+/g, " ");

    expect(tabSwitcher).toHaveClass("shareCenterTabSwitcher", "shareCenterToggleTabs");
    expect(sharesTab).toHaveClass("shareCenterToggleButton", "shareCenterToggleButton--active");
    expect(sharesTab).toHaveAttribute("aria-pressed", "true");
    expect(requestsTab).toHaveClass("shareCenterToggleButton");
    expect(requestsTab).not.toHaveClass("shareCenterToggleButton--active");
    expect(requestsTab).toHaveAttribute("aria-pressed", "false");
    expect(activePill).toHaveClass("shareCenterToggleActivePill", "shareCenterToggleActivePill--shares");
    expect(within(tabSwitcher).queryByTestId("share-tab-toggle-thumb")).not.toBeInTheDocument();
    expect(baseCss).toContain(".shareCenterToggleActivePill {");
    expect(baseCss).toContain(".shareCenterToggleActivePill--shares {");
    expect(baseCss).toContain(".shareCenterToggleActivePill--requests {");
    expect(baseCss).toContain(".shareCenterToggleButton--active {");
    expect(baseCss).toContain("--share-tab-toggle-bg: #6366F1;");
    expect(baseCss).not.toContain("linear-gradient(145deg, #7c3aed, #6d28d9)");
    expect(baseCss).toContain("transform 180ms ease");
    expect(baseCss).toContain("var(--share-tab-toggle-shadow-dark)");
    expect(baseCss).not.toContain("4px 4px 8px");
    expect(baseCss).not.toContain(".shareCenterTabButton--active");
    expect(baseCss).not.toContain(".shareCenterToggleThumb");
    expect(baseCss).not.toContain(".shareCenterToggleSwitch");
    expect(baseCss).toContain("--codepen-neu-bg: #E0E5EC;");
    expect(baseCss).toContain("--codepen-neu-bg-secondary: #D1D9E6;");
    expect(baseCss).toContain("--codepen-neu-text: #2D3748;");
    expect(baseCss).toContain("--codepen-neu-heading: #1A202C;");
    expect(baseCss).toContain("background: var(--codepen-neu-bg) !important;");
    expect(baseCss).toContain(".shareCenterCodepenFrame,");
    expect(baseCss).toContain(".shareCenterCodepenShell,");
    expect(baseCss).toContain(".shareCenterCodepenList,");
    expect(baseCss).not.toContain("--share-center-neu-raised-shadow:");
    expect(baseCss).not.toContain("--share-center-neu-inset-shadow:");
    expect(baseCss).not.toContain("--share-center-neu-pressed-shadow:");
    expect(baseCss).toContain("box-shadow: var(--neu-inset-shadow) !important;");
    expect(baseCss).toContain("box-shadow: var(--neu-raised-shadow) !important;");
    expect(screen.getByTestId("share-workspace-grid")).toHaveClass(
      "grid-cols-1",
      "items-start",
    );
    expect(screen.getByTestId("share-workspace-grid")).not.toHaveClass(
      "xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.86fr)]",
    );
    expect(screen.getByTestId("share-list-panel")).toHaveClass(
      "neu-raised",
      "shareCenterNeuRaisedPanel",
      "rounded-[clamp(1rem,2.4vw,1.25rem)]",
      "border-0",
    );
    expect(screen.getByTestId("share-list-panel")).not.toHaveClass(
      "shareCenterFlatPanel",
      "shadow-none",
    );

    await userEvent.click(requestsTab);

    expect(activePill).toHaveClass("shareCenterToggleActivePill--requests");
    expect(requestsTab).toHaveClass("shareCenterToggleButton--active");
    expect(requestsTab).toHaveAttribute("aria-pressed", "true");
    expect(sharesTab).not.toHaveClass("shareCenterToggleButton--active");
    expect(sharesTab).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(sharesTab);

    expect(activePill).toHaveClass("shareCenterToggleActivePill--shares");
    expect(sharesTab).toHaveClass("shareCenterToggleButton--active");
    expect(requestsTab).not.toHaveClass("shareCenterToggleButton--active");

    expect(screen.getByTestId("share-detail-panel")).toHaveClass(
      "shareCenterNeuRaisedPanel",
      "shareCenterShareDetailPanel",
    );
    expect(screen.getByTestId("share-detail-panel")).not.toHaveClass(
      "settings-neu-inset-panel",
      "lg:sticky",
      "shadow-[var(--neu-inset-shadow)]",
    );
    expect(screen.getByTestId("share-empty-state")).toHaveClass(
      "flex",
      "items-center",
      "justify-center",
      "text-center",
      "shareCenterNeuInsetSurface",
    );
    expect(screen.getByTestId("share-list-scroll")).toHaveClass(
      "neu-inset",
      "settings-neu-inset-panel",
      "shareCenterCodepenList",
      "border-0",
      "flex",
      "items-center",
      "[scrollbar-gutter:stable]",
    );
    expect(screen.getByTestId("share-row-share-1")).toHaveClass(
      "neu-raised-sm",
      "w-full",
      "shareCenterNeuRaisedSurface",
      "shareCenterNeuDataRow",
    );
    expect(screen.getByTestId("share-row-share-1")).not.toHaveClass(
      "sm:grid-cols-[minmax(0,1fr)_max-content]",
    );
    expect(screen.getByTestId("share-row-share-1")).not.toHaveClass(
      "shareCenterFlatSurface",
      "shadow-none",
    );
    expect(screen.getByTestId("share-card-actions-share-1")).toHaveClass(
      "self-end",
      "shareCenterActionTileGroup",
      "justify-end",
    );
    expect(screen.getByTestId("share-status-badge-share-1")).toHaveClass(
      "share-color-badge",
      "shareCenterFlatBadge",
      "inline-flex",
      "w-fit",
      "items-center",
      "bg-emerald-900",
      "text-emerald-200",
    );
    expect(screen.getByTestId("share-status-badge-share-1").querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("share-status-badge-share-2")).toHaveClass(
      "share-color-badge",
      "shareCenterFlatBadge",
      "bg-amber-900",
      "text-amber-200",
    );
    expect(screen.getByTestId("share-kind-badges-share-1")).toHaveClass(
      "flex",
      "flex-wrap",
    );
    expect(screen.getByTestId("share-direct-badge-share-1")).toHaveClass(
      "share-color-badge",
      "shareCenterFlatBadge",
      "inline-flex",
      "w-fit",
      "items-center",
      "bg-emerald-900",
      "text-emerald-200",
    );
    expect(screen.getByTestId("share-direct-badge-share-1").querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("share-row-share-2")).toHaveClass(
      "share-managed-row",
      "shareCenterNeuRaisedSurface",
    );
    expect(screen.getByRole("button", { name: /copy link for brief.md/i })).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--success",
    );
    expect(screen.getByRole("button", { name: /recent activity for brief.md/i })).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--primary",
    );
    expect(screen.getByRole("button", { name: /revoke brief.md/i })).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--danger",
    );

    await userEvent.click(screen.getByRole("button", { name: /recent activity for brief.md/i }));

    expect(shareService.listShareEvents).toHaveBeenCalledWith("share-1");
    expect(await screen.findByText("access")).toBeInTheDocument();
    expect(screen.getByTestId("share-events-panel")).toHaveClass(
      "share-events-list",
      "shareCenterNeuDataList",
      "shareCenterNeuInsetSurface",
    );
    expect(screen.getByTestId("share-event-row-event-1")).toHaveClass(
      "shareCenterNeuDataRow",
      "shareCenterNeuRaisedSurface",
    );
    expect(screen.getByTestId("share-row-share-1")).toHaveClass(
      "neu-inset",
      "shareCenterNeuPressedSurface",
    );
    expect(screen.getByTestId("share-row-share-1")).not.toHaveClass(
      "shadow-[var(--settings-panel-shadow)]",
      "shareCenterFlatSurface--active",
    );

    await userEvent.click(requestsTab);
    expect(activePill).toHaveClass("shareCenterToggleActivePill--requests");
    expect(requestsTab).toHaveClass("shareCenterToggleButton--active");
    expect(requestsTab).toHaveAttribute("aria-pressed", "true");
    expect(sharesTab).not.toHaveClass("shareCenterToggleButton--active");
  });

  it("keeps Share Center CodePen surfaces scoped by light and dark theme", () => {
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8").replace(/\s+/g, " ");
    const actionTileCss = baseCss.match(/\.shareCenterActionTile\s*\{[^}]*\}/)?.[0] ?? "";
    const actionTileGroupCss = baseCss.match(/\.shareCenterActionTileGroup\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileCss =
      baseCss.match(/\.shareCenterCodepenActionTile\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileHoverCss =
      baseCss.match(/\.shareCenterCodepenActionTile:hover\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileActiveCss =
      baseCss.match(/\.shareCenterCodepenActionTile:active\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileSuccessCss =
      baseCss.match(/\.shareCenterCodepenActionTile--success\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTilePrimaryCss =
      baseCss.match(/\.shareCenterCodepenActionTile--primary\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileDangerCss =
      baseCss.match(/\.shareCenterCodepenActionTile--danger\s*\{[^}]*\}/)?.[0] ?? "";
    const codepenActionTileDangerIconCss =
      baseCss.match(/\.shareCenterCodepenActionTile--danger svg\s*\{[^}]*\}/)?.[0] ?? "";

    expect(baseCss).toMatch(
      /:root,\s*:root\[data-theme="dark"\],\s*:root\.dark\s*\{[^}]*--codepen-neu-bg: #1F2937;[^}]*--codepen-neu-bg-secondary: #374151;[^}]*--codepen-neu-text: #F8FAFC;[^}]*--codepen-neu-heading: #F8FAFC;[^}]*--codepen-neu-muted: #CBD5E1;/,
    );
    expect(baseCss).toMatch(
      /:root\[data-theme="light"\],\s*:root\.light\s*\{[^}]*--codepen-neu-bg: #E0E5EC;[^}]*--codepen-neu-bg-secondary: #D1D9E6;[^}]*--codepen-neu-text: #2D3748;[^}]*--codepen-neu-heading: #1A202C;[^}]*--codepen-neu-muted: #718096;/,
    );
    expect(baseCss).not.toMatch(
      /:root,\s*:root\[data-theme="dark"\],\s*:root\.dark\s*\{[^}]*--codepen-neu-bg: #E0E5EC;/,
    );
    expect(baseCss).toContain("--share-center-codepen-button-default-bg: var(--neu-raised-bg);");
    expect(baseCss).toContain("--share-center-codepen-button-primary-bg: #6366F1;");
    expect(baseCss).toContain("--share-center-codepen-button-success-bg: #10B981;");
    expect(baseCss).not.toContain("--share-center-codepen-button-default-bg: linear-gradient");
    expect(baseCss).not.toContain("--share-center-codepen-button-primary-bg: linear-gradient");
    expect(baseCss).not.toContain("--share-center-codepen-button-success-bg: linear-gradient");
    expect(baseCss).toContain("--share-center-codepen-button-danger-icon: #FCA5A5;");
    expect(codepenActionTileCss).toContain("--share-center-codepen-button-bg: var(--share-center-codepen-button-default-bg);");
    expect(codepenActionTileCss).toContain("--share-center-codepen-button-icon: var(--flat-reference-white);");
    expect(codepenActionTileCss).toContain("background: var(--share-center-codepen-button-bg) !important;");
    expect(codepenActionTileCss).toContain("box-shadow: var(--share-center-codepen-button-raised-shadow) !important;");
    expect(codepenActionTileCss).toContain("color: var(--share-center-codepen-button-icon) !important;");
    expect(codepenActionTileCss).toContain("transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease;");
    expect(codepenActionTileCss).not.toContain("background: var(--share-center-action-tile-bg)");
    expect(codepenActionTileHoverCss).toContain("transform: translateY(clamp(-0.08rem, -0.18vw, -0.05rem)) !important;");
    expect(codepenActionTileActiveCss).toContain("box-shadow: var(--share-center-codepen-button-pressed-shadow) !important;");
    expect(codepenActionTileActiveCss).toContain("transform: translateY(clamp(0.04rem, 0.1vw, 0.07rem)) !important;");
    expect(codepenActionTileSuccessCss).toContain("--share-center-codepen-button-bg: var(--share-center-codepen-button-success-bg);");
    expect(codepenActionTilePrimaryCss).toContain("--share-center-codepen-button-bg: var(--share-center-codepen-button-primary-bg);");
    expect(codepenActionTileDangerCss).toContain("--share-center-codepen-button-bg: var(--share-center-codepen-button-default-bg);");
    expect(codepenActionTileDangerCss).toContain("--share-center-codepen-button-icon: var(--share-center-codepen-button-danger-icon);");
    expect(codepenActionTileDangerIconCss).toContain("color: var(--share-center-codepen-button-danger-icon) !important;");
    expect(actionTileGroupCss).toContain("--share-center-action-tile-count: 3");
    expect(actionTileGroupCss).toContain("--share-center-action-tile-gap: clamp(");
    expect(actionTileGroupCss).toContain("container-type: inline-size;");
    expect(actionTileGroupCss).toContain("display: grid !important;");
    expect(actionTileGroupCss).toContain("grid-template-columns: repeat(var(--share-center-action-tile-count), minmax(0, 1fr));");
    expect(actionTileGroupCss).toContain("inline-size: min(100%, 48cqi, 12.75em) !important;");
    expect(actionTileGroupCss).not.toContain("72cqi");
    expect(actionTileGroupCss).not.toContain("18em");
    expect(actionTileCss).toContain("--share-center-action-tile-aspect-ratio: 2.6 / 1");
    expect(actionTileCss).toContain("--share-center-action-tile-inline-size: 100%");
    expect(actionTileCss).toContain("--share-center-action-tile-block-size: calc((100cqi - var(--share-center-action-tile-gap) - var(--share-center-action-tile-gap)) / 7.8)");
    expect(actionTileCss).toContain("inline-size: var(--share-center-action-tile-inline-size)");
    expect(actionTileCss).toContain("block-size: var(--share-center-action-tile-block-size)");
    expect(actionTileCss).toContain("aspect-ratio: var(--share-center-action-tile-aspect-ratio)");
    expect(actionTileCss).toContain("border-radius: 999rem !important;");
    expect(actionTileCss).toContain("min-inline-size: 0 !important;");
    expect(actionTileCss).toContain("min-block-size: 0 !important;");
    expect(actionTileCss).toContain("min-height: 0 !important;");
    expect(actionTileCss).toContain("min-width: 0 !important;");
    expect(actionTileCss).not.toContain("min-inline-size: var(");
    expect(actionTileCss).not.toContain("min-block-size: var(");
    expect(actionTileCss).not.toContain("clamp(4rem");
    expect(actionTileCss).not.toContain("7vw");
    expect(actionTileCss).not.toContain("border-radius: clamp(1rem");
  });

  it("matches the CodePen neuromorphic depth without changing the Share Center palette", () => {
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8").replace(/\s+/g, " ");

    expect(baseCss).not.toContain("--share-center-neu-raised-bg:");
    expect(baseCss).not.toContain("--share-center-neu-inset-bg:");
    expect(baseCss).not.toContain("--share-center-neu-pressed-bg:");
    expect(baseCss).toMatch(
      /\.shareCenterCodepenShell,\s*\.shareCenterNeuRaisedPanel\s*\{[^}]*background: var\(--neu-raised-bg\) !important;/,
    );
    expect(baseCss).toMatch(
      /\.shareCenterNeuRaisedSurface\s*\{[^}]*background: var\(--neu-raised-bg\) !important;[^}]*box-shadow: var\(--neu-raised-sm-shadow\) !important;/,
    );
    expect(baseCss).toMatch(
      /\.shareCenterCodepenFrame,\s*\.shareCenterCodepenList\s*\{[^}]*background: var\(--neu-inset-bg\) !important;[^}]*box-shadow: var\(--neu-inset-shadow\) !important;/,
    );
    expect(baseCss).toMatch(
      /\.shareCenterNeuInsetSurface,\s*\.shareCenterNeuDataList,\s*\.shareCenterNeuControl\s*\{[^}]*background: var\(--neu-inset-bg\) !important;/,
    );
    expect(baseCss).toMatch(
      /\.shareCenterNeuPressedSurface\s*\{[^}]*background: var\(--neu-inset-bg\) !important;[^}]*box-shadow: var\(--neu-pressed-shadow\) !important;/,
    );
    expect(baseCss).toContain("--codepen-neu-bg: #1F2937;");
    expect(baseCss).toContain("--codepen-neu-bg: #E0E5EC;");
    expect(baseCss).toContain("--codepen-neu-bg-secondary: #374151;");
    expect(baseCss).toContain("--codepen-neu-bg-secondary: #D1D9E6;");
    expect(baseCss).not.toContain("--share-center-neu");
  });

  it("copies share links without crashing when navigator.clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    renderShares();

    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /copy link for brief.md/i }));

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByText("链接已复制")).toBeInTheDocument();
    expect(screen.getByTestId("share-alert-stack")).toHaveClass(
      "mb-[clamp(1rem,2.25vw,1.25rem)]",
      "space-y-[clamp(0.78rem,1.8vw,1rem)]",
    );
  });

  it("does not navigate to public File Request pages using token_prefix", async () => {
    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    expect(await screen.findByText("Client upload")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /open public upload page/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/full public link is shown only when created/i)).toBeInTheDocument();

    const unavailableCopyButton = screen.getByRole("button", {
      name: /copy public upload link for Client upload/i,
    });
    expect(unavailableCopyButton).not.toBeDisabled();

    await userEvent.click(unavailableCopyButton);

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(await screen.findByText("完整上传链接只在创建时显示，请使用创建后出现的一次性链接。")).toBeInTheDocument();
  });

  it("shows a dismissible one-time public URL after creating a File Request", async () => {
    vi.mocked(fileRequestService.create).mockResolvedValue({
      id: "request-2",
      folder_id: null,
      title: "Upload files",
      description: null,
      allowed_mime_prefixes: [],
      max_file_size: 1024,
      max_uploads: null,
      upload_count: 0,
      expires_at: null,
      revoked_at: null,
      token_prefix: "new123",
      public_url: "http://localhost:5173/request/full-secret-token",
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    });

    renderShares();
    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    fireEvent.click(screen.getByRole("button", { name: /create file request/i }));

    expect(await screen.findByText("http://localhost:5173/request/full-secret-token")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-secret-panel")).toHaveClass("settings-neu-inset-panel");

    await userEvent.click(screen.getByRole("button", { name: /hide public link/i }));
    await waitFor(() => {
      expect(screen.queryByText("http://localhost:5173/request/full-secret-token")).not.toBeInTheDocument();
    });
  });

  it("shows received uploads for a File Request inside a fluid neuromorphic panel", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    expect(screen.getByTestId("file-request-detail-panel")).toHaveClass(
      "fileRequestInboxDetailPanel",
      "shareCenterRequestDetailPanel",
      "shareCenterNeuRaisedPanel",
    );
    expect(screen.getByTestId("file-request-detail-panel")).not.toHaveClass(
      "lg:sticky",
      "h-full",
      "min-h-[clamp(12rem,30vw,18rem)]",
      "shadow-[var(--neu-inset-shadow)]",
    );

    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    expect(fileRequestService.inbox).toHaveBeenCalledWith({ request_id: "request-1", limit: 50 });
    expect(await screen.findByText("client@example.com")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("contract.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-detail-panel")).toHaveClass(
      "flex",
      "flex-col",
      "w-full",
      "min-w-0",
    );
    expect(screen.getByTestId("file-request-uploads-panel")).toHaveClass(
      "file-request-uploads-list",
      "overflow-visible",
    );
    expect(screen.getByTestId("file-request-uploads-panel")).not.toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-auto",
      "max-h-[min(42vh,24rem)]",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("renders multiple Inbox submissions without capping or clipping the list", async () => {
    vi.mocked(fileRequestService.inbox).mockResolvedValueOnce({
      submissions: Array.from({ length: 2 }, (_, index) => ({
        id: `submission-${index + 1}`,
        request_id: "request-1",
        request_title: "Client upload",
        request_folder_id: "folder-default",
        request_folder_name: "Client Drop",
        submitter_email: `submitter-${index + 1}@example.com`,
        submitter_note: null,
        file_count: index === 0 ? 2 : 1,
        created_at: "2026-05-21T09:00:00Z",
        uploads: [
          {
            id: `upload-${index + 1}`,
            request_id: "request-1",
            submission_id: `submission-${index + 1}`,
            file_id: `file-${index + 1}`,
            filename: `contract-${index + 1}.pdf`,
            file_size: 2048,
            mime_type: "application/pdf",
            status: "pending",
            scan_status: "not_scanned",
            folder_id: "folder-default",
            folder_name: "Client Drop",
            created_at: "2026-05-21T09:00:00Z",
          },
          ...(index === 0
            ? [
                {
                  id: "upload-1-extra",
                  request_id: "request-1",
                  submission_id: "submission-1",
                  file_id: "file-1-extra",
                  filename: "appendix.pdf",
                  file_size: 4096,
                  mime_type: "application/pdf",
                  status: "pending",
                  scan_status: "not_scanned",
                  folder_id: "folder-default",
                  folder_name: "Client Drop",
                  created_at: "2026-05-21T09:01:00Z",
                },
              ]
            : []),
        ],
      })),
      next_cursor: null,
    });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    expect(await screen.findByText("submitter-2@example.com")).toBeInTheDocument();
    expect(screen.getAllByTestId(/file-request-submission-row-/)).toHaveLength(2);
    expect(screen.getByTestId("file-request-uploads-panel")).toHaveClass(
      "overflow-visible",
    );
    expect(screen.getByTestId("file-request-uploads-panel")).not.toHaveClass(
      "max-h-[min(42vh,24rem)]",
      "overflow-auto",
      "min-h-0",
    );
    expect(screen.getByTestId("file-request-upload-actions-upload-1")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-upload-actions-upload-1-extra")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-upload-actions-upload-2")).toBeInTheDocument();
  });

  it("omits the File Requests refresh action from the panel header", async () => {
    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await screen.findByText("Client upload");
    const source = readFileSync(resolve(__dirname, "./Shares.tsx"), "utf8");
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");

    expect(screen.queryByTestId("file-request-refresh-button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh file requests/i })).not.toBeInTheDocument();
    expect(source).not.toContain("RefreshCw");
    expect(source).not.toContain("fileRequestRefreshPrimaryButton");
    expect(baseCss).not.toContain(".fileRequestRefreshPrimaryButton");
  });

  it("shows File Request target locations and approves using a folder selector instead of raw IDs", async () => {
    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    expect(await screen.findAllByText("目标位置：Client Drop")).toHaveLength(2);
    expect(screen.queryByLabelText(/Target folder ID/i)).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /choose publish folder for contract\.pdf/i }));
    await userEvent.click(await screen.findByRole("button", { name: /select folder Reviewed Assets/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => {
      expect(fileRequestService.reviewUpload).toHaveBeenCalledWith("upload-1", {
        action: "approve",
        filename: "contract.pdf",
        folder_id: "folder-reviewed",
        review_note: undefined,
      });
    });
  });

  it("shows approved publish locations and links back to Files", async () => {
    vi.mocked(fileRequestService.inbox).mockResolvedValueOnce({
      submissions: [
        {
          id: "submission-approved",
          request_id: "request-1",
          request_title: "Client upload",
          request_folder_id: "folder-reviewed",
          request_folder_name: "Reviewed Assets",
          submitter_email: "client@example.com",
          submitter_note: null,
          file_count: 1,
          created_at: "2026-05-21T09:00:00Z",
          uploads: [
            {
              id: "upload-approved",
              request_id: "request-1",
              submission_id: "submission-approved",
              file_id: "file-approved",
              filename: "approved.pdf",
              file_size: 2048,
              mime_type: "application/pdf",
              status: "approved",
              scan_status: "not_scanned",
              folder_id: "folder-reviewed",
              folder_name: "Reviewed Assets",
              created_at: "2026-05-21T09:00:00Z",
            },
          ],
        },
      ],
      next_cursor: null,
    });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    const row = await screen.findByTestId("file-request-upload-row-upload-approved");
    expect(within(row).getByText("已发布到：Reviewed Assets")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /open in files for approved\.pdf/i })).toHaveAttribute(
      "href",
      "/files?folder=folder-reviewed",
    );
    expect(within(row).getByRole("link", { name: /preview/i })).toHaveAttribute(
      "href",
      "/api/files/file-approved/preview",
    );
  });

  it("keeps inbox review actions in a fluid equal-width grid instead of intrinsic button widths", async () => {
    vi.mocked(fileRequestService.inbox).mockResolvedValueOnce({
      submissions: [
        {
          id: "submission-approved",
          request_id: "request-1",
          request_title: "Client upload",
          request_folder_id: "folder-reviewed",
          request_folder_name: "Reviewed Assets",
          submitter_email: "client@example.com",
          submitter_note: "Needs final triage",
          file_count: 1,
          created_at: "2026-05-21T09:00:00Z",
          uploads: [
            {
              id: "upload-approved",
              request_id: "request-1",
              submission_id: "submission-approved",
              file_id: "file-approved",
              filename: "approved.pdf",
              file_size: 2048,
              mime_type: "application/pdf",
              status: "approved",
              scan_status: "not_scanned",
              folder_id: "folder-reviewed",
              folder_name: "Reviewed Assets",
              created_at: "2026-05-21T09:00:00Z",
            },
          ],
        },
      ],
      next_cursor: null,
    });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    const row = await screen.findByTestId("file-request-upload-row-upload-approved");
    const actionGrid = within(row).getByTestId("file-request-upload-actions-upload-approved");
    expect(actionGrid).toHaveClass(
      "grid",
      "w-full",
      "grid-cols-[repeat(auto-fit,minmax(min(100%,clamp(7.5rem,24vw,9rem)),1fr))]",
    );
    expect(actionGrid).not.toHaveClass("md:grid-cols-4");

    expect(within(row).getByRole("link", { name: /^Preview$/i })).toHaveClass("inline-flex", "w-full", "min-w-0");
    expect(within(row).getByRole("link", { name: /open in files/i })).toHaveClass("inline-flex", "w-full", "min-w-0");
    expect(within(row).getByRole("button", { name: /^Approve$/i })).toHaveClass("w-full", "min-w-0");
    expect(within(row).getByRole("button", { name: /^Reject$/i })).toHaveClass("w-full", "min-w-0");
  });

  it("styles inbox review actions as colored status pills", async () => {
    vi.mocked(fileRequestService.inbox).mockResolvedValueOnce({
      submissions: [
        {
          id: "submission-approved",
          request_id: "request-1",
          request_title: "Client upload",
          request_folder_id: "folder-reviewed",
          request_folder_name: "Reviewed Assets",
          submitter_email: "client@example.com",
          submitter_note: "Needs final triage",
          file_count: 1,
          created_at: "2026-05-21T09:00:00Z",
          uploads: [
            {
              id: "upload-approved",
              request_id: "request-1",
              submission_id: "submission-approved",
              file_id: "file-approved",
              filename: "approved.pdf",
              file_size: 2048,
              mime_type: "application/pdf",
              status: "approved",
              scan_status: "not_scanned",
              folder_id: "folder-reviewed",
              folder_name: "Reviewed Assets",
              created_at: "2026-05-21T09:00:00Z",
            },
          ],
        },
      ],
      next_cursor: null,
    });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    const row = await screen.findByTestId("file-request-upload-row-upload-approved");
    const previewAction = within(row).getByRole("link", { name: /^Preview$/i });
    const openInFilesAction = within(row).getByRole("link", { name: /open in files/i });
    const approveAction = within(row).getByRole("button", { name: /^Approve$/i });
    const rejectAction = within(row).getByRole("button", { name: /^Reject$/i });
    const source = readFileSync(resolve(__dirname, "./Shares.tsx"), "utf8");
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");
    const basePillCss = baseCss.match(/\.fileRequestReviewActionPill\s*\{[^}]*\}/)?.[0] ?? "";
    const previewPillCss = baseCss.match(/\.fileRequestReviewActionPill--preview\s*\{[^}]*\}/)?.[0] ?? "";
    const approvePillCss = baseCss.match(/\.fileRequestReviewActionPill--approve\s*\{[^}]*\}/)?.[0] ?? "";
    const disabledPillCss = baseCss.match(/\.fileRequestReviewActionPill:disabled\s*\{[^}]*\}/)?.[0] ?? "";
    const disabledApprovePillCss =
      baseCss.match(/\.fileRequestReviewActionPill--approve:disabled\s*\{[^}]*\}/)?.[0] ?? "";
    const disabledRejectPillCss =
      baseCss.match(/\.fileRequestReviewActionPill--reject:disabled\s*\{[^}]*\}/)?.[0] ?? "";
    const disabledApprovePillCompactCss = disabledApprovePillCss.replace(/\s+/g, " ");
    const disabledRejectPillCompactCss = disabledRejectPillCss.replace(/\s+/g, " ");
    const approveDisabledBackgroundTokens = [
      ...baseCss.matchAll(/--file-request-review-action-approve-disabled-bg:\s*([^;]+);/g),
    ].map((match) => match[1].trim());
    const rejectDisabledBackgroundTokens = [
      ...baseCss.matchAll(/--file-request-review-action-reject-disabled-bg:\s*([^;]+);/g),
    ].map((match) => match[1].trim());

    expect(previewAction).toHaveClass("fileRequestReviewActionPill", "fileRequestReviewActionPill--preview");
    expect(openInFilesAction).toHaveClass("fileRequestReviewActionPill", "fileRequestReviewActionPill--open");
    expect(approveAction).toHaveClass("fileRequestReviewActionPill", "fileRequestReviewActionPill--approve");
    expect(rejectAction).toHaveClass("fileRequestReviewActionPill", "fileRequestReviewActionPill--reject");
    expect(approveAction).toBeDisabled();
    expect(rejectAction).toBeDisabled();
    expect(source).toContain("fileRequestReviewActionPillBaseClass");
    expect(source).toContain("fileRequestReviewActionPillToneClass");
    expect(baseCss).toContain(".fileRequestReviewActionPill {");
    expect(basePillCss).toContain("border-color: transparent !important;");
    expect(basePillCss).toContain("box-shadow: var(--neu-raised-sm-shadow) !important;");
    expect(basePillCss).toContain("text-shadow: none !important;");
    expect(baseCss).toContain(".fileRequestReviewActionPill--preview {");
    expect(baseCss).toContain("--flat-reference-panel-bg: #E2E8F0;");
    expect(baseCss).toContain("--flat-reference-card-bg: #F8FAFC;");
    expect(baseCss).toContain("--flat-reference-purple: #6366F1;");
    expect(baseCss).toContain("--flat-reference-green: #10B981;");
    expect(baseCss).toContain(".shareCenterFlatIconButton--green");
    expect(baseCss).toContain(".shareCenterFlatIconButton--red");
    expect(previewPillCss).toContain("background: var(--flat-reference-purple) !important;");
    expect(previewPillCss).not.toContain("box-shadow: none !important;");
    expect(previewPillCss).not.toContain("linear-gradient");
    expect(previewPillCss).not.toContain("inset");
    expect(previewPillCss).not.toContain("--rgb-fuchsia-500");
    expect(baseCss).toContain(".fileRequestReviewActionPill--open {");
    expect(baseCss).toContain("background: var(--flat-reference-amber) !important;");
    expect(baseCss).toContain(".fileRequestReviewActionPill--approve {");
    expect(approvePillCss).toContain("background: var(--flat-reference-green) !important;");
    expect(source).toContain("bg-emerald-900 text-emerald-200");
    expect(source).toContain("bg-amber-900 text-amber-200");
    expect(source).toContain("bg-red-900 text-red-200");
    expect(baseCss).toContain(".fileRequestReviewActionPill--reject {");
    expect(baseCss).toContain("background: var(--flat-reference-red) !important;");
    expect(baseCss).toContain(".fileRequestReviewActionPill:disabled {");
    expect(baseCss).toContain("--file-request-review-action-disabled-text:");
    expect(disabledPillCss).toContain("box-shadow: var(--neu-pressed-shadow) !important;");
    expect(disabledPillCss).toContain("color: var(--file-request-review-action-disabled-text) !important;");
    expect(disabledPillCss).toContain("cursor: not-allowed;");
    expect(disabledPillCss).toContain("appearance: none;");
    expect(disabledPillCss).toContain("-webkit-appearance: none;");
    expect(disabledPillCss).toContain("filter: none !important;");
    expect(disabledPillCss).toContain("opacity: 1 !important;");
    expect(disabledApprovePillCompactCss).toMatch(
      /background:\s*var\(\s*--file-request-review-action-approve-disabled-bg\s*\)\s*!important;/,
    );
    expect(disabledApprovePillCss).toContain("background-image: none !important;");
    expect(disabledApprovePillCss).toContain("border: 0 !important;");
    expect(disabledApprovePillCss).not.toContain("border-color");
    expect(disabledApprovePillCss).toContain("color: var(--file-request-review-action-approve-disabled-text) !important;");
    expect(disabledRejectPillCompactCss).toMatch(
      /background:\s*var\(\s*--file-request-review-action-reject-disabled-bg\s*\)\s*!important;/,
    );
    expect(disabledRejectPillCss).toContain("background-image: none !important;");
    expect(disabledRejectPillCss).toContain("border: 0 !important;");
    expect(disabledRejectPillCss).not.toContain("border-color");
    expect(disabledRejectPillCss).toContain("color: var(--file-request-review-action-reject-disabled-text) !important;");
    expect(baseCss).toContain("--file-request-review-action-approve-disabled-bg:");
    expect(baseCss).toContain("--file-request-review-action-reject-disabled-bg:");
    expect(baseCss).toContain("--file-request-review-action-approve-disabled-text: #064E3B;");
    expect(baseCss).not.toContain("--file-request-review-action-approve-disabled-border");
    expect(baseCss).not.toContain("--file-request-review-action-reject-disabled-border");
    expect(approveDisabledBackgroundTokens).toEqual([
      "#A7F3D0",
      "#A7F3D0",
    ]);
    expect(rejectDisabledBackgroundTokens).toEqual([
      "rgb(var(--rgb-red-200))",
      "rgb(var(--rgb-red-200))",
    ]);
    expect(approveDisabledBackgroundTokens.join(" ")).not.toContain("rgba(");
    expect(approveDisabledBackgroundTokens.join(" ")).not.toContain("linear-gradient");
    expect(rejectDisabledBackgroundTokens.join(" ")).not.toContain("rgba(");
    expect(rejectDisabledBackgroundTokens.join(" ")).not.toContain("linear-gradient");
    expect(source).not.toContain("disabled:opacity-55");
    expect(baseCss).toContain("var(--flat-reference-green)");
    expect(baseCss).toContain("var(--flat-reference-amber)");
    expect(baseCss).toContain("var(--flat-reference-red)");
    expect(baseCss).toContain("opacity: 1 !important;");
    expect(baseCss).not.toContain("fileRequestReviewActionPill { border-color: rgba(255, 255, 255, 0.08)");
    expect(baseCss).not.toContain("saturate(0.24)");
    expect(baseCss).not.toContain("brightness(0.86)");
    expect(baseCss).not.toContain("saturate(0.82)");
    expect(baseCss).not.toContain("--rgb-amber-300");
    expect(baseCss).not.toContain("--rgb-emerald-700");
    expect(baseCss).not.toContain("--rgb-red-800");
  });

  it("renders File Request review submissions as a fluid neuromorphic inspector", async () => {
    vi.mocked(fileRequestService.inbox).mockResolvedValueOnce({
      submissions: [
        {
          id: "submission-designed",
          request_id: "request-1",
          request_title: "Client upload",
          request_folder_id: "folder-reviewed",
          request_folder_name: "Reviewed Assets",
          submitter_email: "www.smoking.sexy@gmail.com",
          submitter_note: "人机二号",
          file_count: 1,
          created_at: "2026-05-26T15:53:53Z",
          uploads: [
            {
              id: "upload-designed",
              request_id: "request-1",
              submission_id: "submission-designed",
              file_id: "file-designed",
              filename: "mmexport1779631810594.jpg",
              file_size: 1142947,
              mime_type: "image/jpeg",
              status: "approved",
              scan_status: "not_scanned",
              folder_id: "folder-reviewed",
              folder_name: "webDAV",
              created_at: "2026-05-26T15:53:53Z",
            },
          ],
        },
      ],
      next_cursor: null,
    });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));

    const submissionRow = await screen.findByTestId("file-request-submission-row-submission-designed");
    const uploadRow = await screen.findByTestId("file-request-upload-row-upload-designed");
    const summaryStrip = within(submissionRow).getByTestId("file-request-submission-summary-strip-submission-designed");
    const fileHeader = within(uploadRow).getByTestId("file-request-upload-header-upload-designed");
    const statusRow = within(fileHeader).getByTestId("file-request-upload-status-row-upload-designed");
    const publishPanel = within(uploadRow).getByTestId("file-request-upload-publish-upload-designed");
    const reviewPanel = within(uploadRow).getByTestId("file-request-upload-review-upload-designed");
    const reviewGrid = within(uploadRow).getByTestId("file-request-upload-review-grid-upload-designed");

    expect(submissionRow).toHaveClass(
      "fileRequestInboxSubmissionCard",
      "fileRequestInboxSubmissionCard--inspector",
      "shareCenterNeuRaisedSurface",
    );
    expect(submissionRow).not.toHaveClass("settings-neu-inset-panel");
    expect(summaryStrip).toHaveClass(
      "fileRequestInboxSummaryStrip",
      "grid",
      "shareCenterNeuInsetSurface",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-submitter-value-submission-designed")).toHaveClass(
      "font-semibold",
      "leading-[1.35]",
      "shareSubmissionFlatText",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-note-value-submission-designed")).toHaveClass(
      "font-medium",
      "leading-[1.45]",
      "shareSubmissionFlatText",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-summary-submission-designed")).toHaveClass(
      "fileRequestInboxSummaryCell",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-target-submission-designed")).toHaveClass(
      "fileRequestInboxSummaryCell",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-summary-value-submission-designed")).toHaveClass(
      "shareSubmissionFlatText",
    );
    expect(within(summaryStrip).getByTestId("file-request-submission-target-value-submission-designed")).toHaveClass(
      "shareSubmissionFlatText",
    );
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");
    const compactBaseCss = baseCss.replace(/\s+/g, " ");
    expect(baseCss).toContain(".shareSubmissionFlatText");
    expect(baseCss).toContain(".shareCenterNeuInsetSurface");
    expect(baseCss).toContain(".shareCenterNeuActionButton");
    expect(baseCss).toContain(".shareCenterNeuControl");
    expect(baseCss).toContain(".fileRequestInboxSummaryStrip");
    expect(baseCss).toContain(".fileRequestInboxFileItem");
    expect(baseCss).toContain(".fileRequestInboxReviewGrid");
    expect(baseCss).toContain("--file-request-inbox-flat-bg: #1F2937;");
    expect(baseCss).toContain("--file-request-inbox-flat-field-bg: #111827;");
    expect(baseCss).toContain("--file-request-inbox-text-shadow: none;");
    expect(compactBaseCss).toMatch(/\.fileRequestInboxDetailPanel \{[^}]*box-shadow: var\(--neu-raised-shadow\) !important;/);
    expect(compactBaseCss).toMatch(/\.fileRequestInboxSubmissionCard \{[^}]*box-shadow: var\(--neu-raised-sm-shadow\) !important;/);
    expect(compactBaseCss).toMatch(/\.fileRequestInboxSummaryStrip \{[^}]*box-shadow: var\(--neu-inset-shadow\) !important;/);
    expect(compactBaseCss).toMatch(/\.fileRequestInboxFileItem \{[^}]*box-shadow: var\(--neu-raised-sm-shadow\) !important;/);
    expect(compactBaseCss).toMatch(/\.fileRequestInboxFlat(Input|Field) \{[^}]*box-shadow: var\(--neu-inset-shadow\) !important;/);
    expect(baseCss).not.toContain("0 0.042em 0 rgba(8, 12, 20, 0.72)");
    expect(baseCss).not.toContain("0 -0.032em 0 rgba(255, 255, 255, 0.09)");
    expect(baseCss).not.toContain("1px 0 rgba(10, 16, 26, 0.78)");
    expect(baseCss).not.toContain("2px 6px rgba(7, 11, 19, 0.34)");
    expect(fileHeader).toHaveClass(
      "fileRequestInboxFileHeader",
      "flex",
      "flex-wrap",
    );
    expect(fileHeader).not.toHaveTextContent("Uploaded file");
    expect(fileHeader).not.toHaveTextContent("mmexport1779631810594.jpg");
    expect(fileHeader).not.toHaveTextContent(/KB|MB/);
    expect(statusRow).toHaveClass("fileRequestInboxUploadStatusRow", "flex", "flex-wrap");
    expect(publishPanel).toHaveClass(
      "fileRequestInboxPublishPanel",
      "grid",
      "shareCenterNeuInsetSurface",
    );
    expect(reviewPanel).toHaveClass(
      "fileRequestInboxReviewPanel",
      "grid",
      "shareCenterNeuInsetSurface",
    );
    expect(reviewGrid).toHaveClass(
      "fileRequestInboxReviewGrid",
      "grid",
    );
    expect(within(uploadRow).getByTestId("file-request-upload-status-upload-designed")).toHaveClass(
      "share-color-badge",
    );
    expect(within(uploadRow).getByText("已发布到：webDAV")).toHaveClass(
      "fileRequestInboxFlatField",
      "shareCenterNeuControl",
    );
    expect(within(uploadRow).getByText("已发布到：webDAV")).not.toHaveClass("settings-neu-inset-panel");
    expect(within(uploadRow).getByLabelText("Review filename for mmexport1779631810594.jpg")).toHaveClass(
      "fileRequestInboxFlatInput",
      "shareCenterNeuControl",
    );
    expect(within(uploadRow).getByLabelText("Review note for mmexport1779631810594.jpg")).toHaveClass(
      "fileRequestInboxFlatInput",
      "shareCenterNeuControl",
    );
  });

  it("uses light-mode-safe Inbox surfaces instead of hard-coded dark panels", () => {
    const source = readFileSync(resolve(__dirname, "./Shares.tsx"), "utf8");
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8").replace(/\s+/g, " ");

    expect(source).toContain("fileRequestInboxSubmissionCard");
    expect(source).toContain("fileRequestInboxSummaryStrip");
    expect(source).toContain("fileRequestInboxUploadRow");
    expect(source).toContain("fileRequestInboxFileItem");
    expect(source).toContain("fileRequestInboxFileHeader");
    expect(source).toContain("fileRequestInboxReviewGrid");
    expect(source).toContain("fileRequestInboxDetailPanel");
    expect(source).toContain("fileRequestInboxFlatInput");
    expect(source).toContain("fileRequestInboxFlatField");
    expect(source).toContain("fileRequestInboxEyebrow");
    expect(source).toContain("fileRequestInboxStrongText");
    expect(source).not.toContain("fileRequestInboxMetaPanel");
    expect(source).not.toContain("fileRequestInboxSectionPanel");
    expect(source).toContain("shareSubmissionFlatText");
    expect(source).not.toContain("rgba(69,82,106");
    expect(source).not.toContain("rgba(46,57,76");
    expect(source).not.toContain("rgba(247,249,255");
    expect(baseCss).toMatch(
      /:root\[data-theme="light"\],\s*:root\.light\s*\{[^}]*--file-request-inbox-summary-bg:/,
    );
    expect(baseCss).toContain("--file-request-inbox-strong-text: rgba(var(--rgb-slate-900), 0.94);");
    expect(baseCss).toContain(".fileRequestInboxSummaryStrip");
    expect(baseCss).toContain(".fileRequestInboxFileItem");
    expect(baseCss).toContain(".fileRequestInboxReviewGrid");
    expect(baseCss).toContain(".fileRequestInboxFlatInput");
    expect(baseCss).toContain("text-shadow: none !important;");
  });

  it("uses separate fluid workspace helpers for Shares master-detail and File Requests stack", () => {
    const source = readFileSync(resolve(__dirname, "./Shares.tsx"), "utf8");

    expect(source).toContain("shareCenterSharesWorkspaceGridClass");
    expect(source).toContain("shareCenterRequestStackClass");
    expect(source).not.toContain("const shareCenterWorkspaceGridClass");
    expect(source).toContain("shareCenterNeuDataList");
    expect(source).toContain("shareCenterNeuDataRow");
    expect(source).toContain("shareCenterNeuFormInput");
    expect(source).toContain("shareCenterCreatePillButton");
    expect(source).toContain("shareCenterActionTile");
    expect(source).toContain("shareCenterCodepenActionTile");
    expect(source).toContain("fileRequestReviewActionGridClass");
    expect(source).toContain("fileRequestFluidActionClass");
    expect(source).toContain("fileRequestActionButtonClass");
    expect(source).toContain("file-request-controls-grid");
    expect(source).toContain("fileRequestUploadsPanelClass");
    expect(source).toContain("md:grid-cols-[minmax(0,1fr)_minmax(0,0.24fr)]");
    expect(source).toContain("inline-flex w-full min-w-0 items-center justify-center");
    expect(source).not.toContain("xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.86fr)]");
    expect(source).not.toContain("sm:w-[clamp(8.75rem,11vw,9.5rem)]");
    expect(source).not.toContain("minmax(22rem,0.78fr)");
    expect(source).not.toContain("activeUploads.submissions.length > 1 && \"max-h-[min(42vh,24rem)]\"");
    expect(source).not.toContain("file-request-uploads-list flex-1 min-h-0");
  });

  it("loads additional File Request inbox pages with the returned cursor", async () => {
    vi.mocked(fileRequestService.inbox)
      .mockResolvedValueOnce({
        submissions: [
          {
            id: "submission-1",
            request_id: "request-1",
            submitter_email: "client@example.com",
            submitter_note: "Signed contract",
            file_count: 1,
            created_at: "2026-05-21T09:00:00Z",
            uploads: [],
          },
        ],
        next_cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        submissions: [
          {
            id: "submission-2",
            request_id: "request-1",
            submitter_email: "second@example.com",
            submitter_note: null,
            file_count: 1,
            created_at: "2026-05-20T09:00:00Z",
            uploads: [],
          },
        ],
        next_cursor: null,
      });

    renderShares();

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));
    await userEvent.click(await screen.findByRole("button", { name: /load more inbox submissions/i }));

    expect(fileRequestService.inbox).toHaveBeenLastCalledWith({
      request_id: "request-1",
      limit: 50,
      cursor: "cursor-1",
    });
    expect(await screen.findByText("second@example.com")).toBeInTheDocument();
  });

  it("keeps share and file request management usable on narrow mobile screens", async () => {
    renderShares();

    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    expect(screen.getByTestId("share-center-shell")).toHaveClass("max-w-full", "overflow-hidden");
    expect(screen.getByTestId("share-tab-switcher")).toHaveClass("w-full", "sm:w-auto");
    expect(screen.getByTestId("share-workspace-grid")).toHaveClass(
      "grid-cols-1",
    );
    expect(screen.getByTestId("share-workspace-grid")).not.toHaveClass(
      "xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.86fr)]",
    );
    expect(screen.getByTestId("share-list-scroll")).toHaveClass(
      "max-h-none",
      "overflow-visible",
      "sm:max-h-[min(62vh,42rem)]",
      "sm:overflow-auto",
    );
    expect(screen.getByTestId("share-card-actions-share-1")).toHaveClass(
      "w-full",
      "justify-end",
      "shareCenterActionTileGroup",
    );

    await userEvent.click(screen.getByRole("button", { name: /recent activity for brief.md/i }));
    expect(await screen.findByText("access")).toBeInTheDocument();
    expect(screen.getByTestId("share-events-heading-row")).toHaveClass(
      "flex-row",
      "items-center",
      "justify-between",
    );
    expect(screen.getByTestId("share-events-heading-row")).not.toHaveClass(
      "flex-col",
      "items-stretch",
      "sm:flex-row",
    );
    expect(screen.getByTestId("share-events-title-block")).toHaveClass(
      "min-w-0",
      "flex-1",
    );
    expect(screen.getByRole("button", { name: /close share activity/i })).toHaveClass(
      "shareCenterNeuActionButton",
      "shareCenterClosePillButton",
      "ml-auto",
      "shrink-0",
      "self-center",
    );
    expect(screen.getByRole("button", { name: /close share activity/i })).not.toHaveClass(
      "self-start",
      "sm:self-auto",
    );
    expect(screen.getByRole("button", { name: /close share activity/i })).not.toHaveClass(
      "shareCenterActionTile",
      "shareCenterDarkActionTile",
    );
    expect(screen.getByTestId("share-events-panel")).toHaveClass(
      "shareCenterNeuDataList",
      "shareCenterNeuInsetSurface",
    );
    expect(screen.getByTestId("share-event-row-event-1")).toHaveClass(
      "grid",
      "shareCenterNeuDataRow",
      "shareCenterNeuRaisedSurface",
      "sm:grid-cols-[minmax(0,1fr)_auto_auto]",
    );

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));
    expect(await screen.findByText("Client upload")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-workspace-grid")).toHaveClass(
      "shareCenterRequestStack",
      "grid-cols-1",
      "items-stretch",
    );
    expect(screen.getByTestId("file-request-workspace-grid")).not.toHaveClass(
      "xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.86fr)]",
    );
    expect(screen.getByTestId("file-request-list-panel")).toHaveClass(
      "neu-raised",
      "shareCenterNeuRaisedPanel",
      "border-0",
    );
    expect(screen.getByTestId("file-request-list-panel")).not.toHaveClass(
      "shareCenterFlatPanel",
      "shadow-none",
    );
    expect(screen.getByTestId("file-request-controls-grid")).toHaveClass(
      "grid",
      "md:grid-cols-[minmax(0,1fr)_minmax(0,0.24fr)]",
      "md:items-stretch",
    );
    expect(screen.getByTestId("file-request-list-heading-row")).toHaveClass(
      "min-w-0",
      "md:col-span-2",
    );
    expect(screen.getByTestId("file-request-detail-panel")).toHaveClass(
      "fileRequestInboxDetailPanel",
      "shareCenterRequestDetailPanel",
      "shareCenterNeuRaisedPanel",
      "w-full",
      "min-w-0",
    );
    expect(screen.getByTestId("file-request-detail-panel")).not.toHaveClass(
      "settings-neu-inset-panel",
      "lg:sticky",
      "h-full",
      "min-h-[clamp(12rem,30vw,18rem)]",
      "shadow-[var(--neu-inset-shadow)]",
    );
    expect(screen.queryByTestId("file-request-refresh-button")).not.toBeInTheDocument();
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8").replace(/\s+/g, " ");
    const filtersCss = readFileSync(
      resolve(__dirname, "../components/files/list/FileListFilters.css"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(baseCss).toContain("background: var(--codepen-neu-bg) !important;");
    expect(baseCss).toContain("--codepen-neu-bg-secondary: #D1D9E6;");
    expect(baseCss).not.toContain("--share-center-neu-form-input-bg:");
    expect(baseCss).not.toContain("--share-center-neu-form-input-shadow:");
    expect(baseCss).toMatch(
      /\.shareCenterNeuFormInput \{[^}]*background: var\(--neu-inset-bg\) !important;[^}]*box-shadow: var\(--neu-inset-shadow\) !important;/,
    );
    expect(filtersCss).toContain(".filtersSearchPill {");
    expect(filtersCss).not.toContain(".neuromorphic-style .filtersSearchPill");
    expect(filtersCss).not.toContain("background: var(--settings-panel-bg)");
    expect(baseCss).toMatch(
      /\.fileRequestCreateInput \{[^}]*background: var\(--neu-inset-bg\) !important;[^}]*border: 0 !important;[^}]*border-radius: 999px !important;[^}]*box-shadow: var\(--neu-inset-shadow\) !important;/,
    );
    expect(baseCss).not.toContain(".fileRequestRefreshPrimaryButton");
    expect(screen.getByTestId("file-request-title-input")).toHaveClass(
      "fileRequestCreateControl",
      "fileRequestCreateInput",
      "shareCenterNeuControl",
      "shareCenterNeuFormInput",
      "md:col-start-1",
      "md:row-start-2",
    );
    expect(screen.getByRole("button", { name: /create file request/i })).toHaveClass(
      "fileRequestCreateControl",
      "fileRequestCreateButton",
      "shareCenterNeuActionButton",
      "shareCenterCreatePillButton",
      "w-full",
      "md:col-start-2",
      "md:row-start-2",
    );
    expect(screen.getByTestId("file-request-empty-state")).toHaveClass(
      "items-center",
      "justify-center",
      "text-center",
      "shareCenterNeuInsetSurface",
    );
    expect(screen.getByTestId("file-request-list-scroll")).toHaveClass(
      "shareCenterCodepenList",
      "max-h-none",
      "overflow-visible",
      "sm:max-h-[min(62vh,42rem)]",
      "sm:overflow-auto",
    );
    expect(screen.getByTestId("file-request-row-request-1")).toHaveClass(
      "neu-raised-sm",
      "w-full",
      "shareCenterNeuRaisedSurface",
      "shareCenterNeuDataRow",
    );
    expect(screen.getByTestId("file-request-row-request-1")).not.toHaveClass(
      "sm:grid-cols-[minmax(0,1fr)_max-content]",
    );
    expect(screen.getByTestId("file-request-row-request-1")).not.toHaveClass(
      "shareCenterFlatSurface",
      "shadow-none",
    );
    expect(screen.getByTestId("file-request-actions-request-1")).toHaveClass(
      "w-full",
      "justify-end",
      "self-end",
      "shareCenterActionTileGroup",
    );
    expect(
      screen.getByRole("button", { name: /copy public upload link for Client upload/i }),
    ).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--success",
    );
    expect(
      screen.getByRole("button", { name: /received uploads for Client upload/i }),
    ).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--primary",
    );
    expect(
      screen.getByRole("button", { name: /revoke file request Client upload/i }),
    ).toHaveClass(
      "shareCenterFlatIconButton",
      "shareCenterNeuActionButton",
      "shareCenterActionTile",
      "shareCenterCodepenActionTile",
      "shareCenterCodepenActionTile--danger",
    );

    await userEvent.click(await screen.findByRole("button", { name: /received uploads for Client upload/i }));
    expect(await screen.findByDisplayValue("contract.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-uploads-panel")).toHaveClass("overflow-visible");
    expect(screen.getByTestId("file-request-uploads-panel")).not.toHaveClass("overflow-auto");
    const headingRow = screen.getByTestId("file-request-uploads-heading-row");
    expect(headingRow).toHaveClass("flex-row", "items-center", "justify-between");
    expect(headingRow).not.toHaveClass("flex-col", "items-stretch", "sm:flex-row");
    expect(screen.getByTestId("file-request-uploads-title")).toHaveClass(
      "min-w-0",
      "flex-1",
      "truncate",
    );
    const closeButton = screen.getByRole("button", { name: /Close received uploads/i });
    expect(closeButton).toHaveClass("ml-auto", "shrink-0", "self-center");
    expect(closeButton).not.toHaveClass("w-full", "shareCenterActionTile");
    expect(screen.getByTestId("file-request-upload-row-upload-1")).toHaveClass(
      "grid",
    );
  });

  it("turns share and File Request mobile lists into internal scroll regions after five items", async () => {
    vi.mocked(shareService.listManagedShares).mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        id: `share-${index + 1}`,
        file_id: `file-${index + 1}`,
        filename: `brief-${index + 1}.md`,
        share_token: `share-token-${index + 1}`,
        expires_at: null,
        max_downloads: null,
        download_count: index,
        access_count: index + 1,
        has_password: index === 0,
        status: "active",
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
      })),
    );
    vi.mocked(fileRequestService.list).mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => ({
        id: `request-${index + 1}`,
        folder_id: null,
        title: `Client upload ${index + 1}`,
        description: null,
        allowed_mime_prefixes: [],
        max_file_size: 1024,
        max_uploads: null,
        upload_count: index,
        expires_at: null,
        revoked_at: null,
        token_prefix: `abc12${index}`,
        public_url: null,
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
      })),
    );

    renderShares();

    expect(await screen.findByText("brief-6.md")).toBeInTheDocument();
    expect(screen.getByTestId("share-list-scroll")).toHaveClass(
      "mobile-five-item-scroll",
      "max-h-[min(70vh,36rem)]",
      "overflow-auto",
    );
    expect(screen.getByTestId("share-list-scroll")).not.toHaveClass(
      "max-h-none",
      "overflow-visible",
    );

    await userEvent.click(await screen.findByRole("button", { name: /file requests/i }));

    expect(await screen.findByText("Client upload 6")).toBeInTheDocument();
    expect(screen.getByTestId("file-request-list-scroll")).toHaveClass(
      "mobile-five-item-scroll",
      "max-h-[min(70vh,36rem)]",
      "overflow-auto",
    );
    expect(screen.getByTestId("file-request-list-scroll")).not.toHaveClass(
      "max-h-none",
      "overflow-visible",
    );
  });
});
