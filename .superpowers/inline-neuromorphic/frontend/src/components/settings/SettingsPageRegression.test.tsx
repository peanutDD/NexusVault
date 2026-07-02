import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { User } from "../../types/auth";
import type { ApiToken } from "../../services/apiTokens";
import Settings from "../../pages/Settings";
import UserInfoSection from "./UserInfoSection";
import ApiTokenSection from "./ApiTokenSection";
import PageLayout from "../layout/PageLayout";
import {
  settingsInputClass,
  settingsLabelClass,
  settingsPanelClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "./settingsUi";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/auth";
import {
  useApiTokens,
  useCreateApiToken,
  useCreateWebDavWizardToken,
  useDeleteApiToken,
  useUpdateApiToken,
  useWebDavActivity,
  useWebDavDiagnostics,
} from "../../hooks/useApiTokens";
import { useStorageUsage } from "../../hooks/useStorageUsage";
import { useOcrStatus } from "../../hooks/useOcrStatus";

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../services/auth", () => ({
  authService: {
    sendEmailVerification: vi.fn(),
    checkProfileAvailability: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("../../hooks/useApiTokens", () => ({
  useApiTokens: vi.fn(),
  useCreateApiToken: vi.fn(),
  useCreateWebDavWizardToken: vi.fn(),
  useDeleteApiToken: vi.fn(),
  useUpdateApiToken: vi.fn(),
  useWebDavActivity: vi.fn(),
  useWebDavDiagnostics: vi.fn(),
}));

vi.mock("../../hooks/useStorageUsage", () => ({
  useStorageUsage: vi.fn(),
}));

vi.mock("../../hooks/useOcrStatus", () => ({
  useOcrStatus: vi.fn(),
}));

vi.mock("../../hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

const mockUpdateUser = vi.fn();
const mockCreateMutate = vi.fn();
const mockCreateWebDavMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockUpdateTokenMutate = vi.fn();

const currentUser: User = {
  id: "user-1",
  username: "alice",
  email: "alice@example.com",
  created_at: "2026-05-04T00:00:00Z",
};

const settingsRuntimeSourceFiles = [
  "../../pages/Settings.tsx",
  "./SettingsCard.tsx",
  "./settingsUi.ts",
  "./UserInfoSection.tsx",
  "./PasswordChangeSection.tsx",
  "./ApiTokenSection.tsx",
  "./WebDavAccessSection.tsx",
  "./OcrStatusSection.tsx",
  "./StorageUsageSection.tsx",
] as const;

function stripFluidClampSegments(line: string) {
  return line.replace(/clamp\([^)]*\)/g, "clamp()");
}

function findSettingsFixedSizingOffenders() {
  const fixedSizingRe =
    /(?:\b(?:min|max|minmax|calc)\([^`'"\n]*\d+(?:\.\d+)?rem\b|\b(?:w|h|min-w|min-h|max-w|max-h|grid-cols)-\[[^\]\n]*\d+(?:\.\d+)?rem\b|\b(?:fontSize|width|height):\s*`\$\{[^`]+\}px`)/;

  return settingsRuntimeSourceFiles.flatMap((sourceFile) => {
    const absolutePath = resolve(__dirname, sourceFile);
    return readFileSync(absolutePath, "utf8")
      .split("\n")
      .flatMap((line, index) => {
        if (line.includes("fluid-sizing-allow:")) return [];
        const normalizedLine = stripFluidClampSegments(line);
        return fixedSizingRe.test(normalizedLine)
          ? [`${sourceFile}:${index + 1}: ${line.trim()}`]
          : [];
      });
  });
}

function asApiTokensQuery(data: ApiToken[], isLoading = false) {
  return { data, isLoading } as unknown as ReturnType<typeof useApiTokens>;
}

function asCreateTokenMutation() {
  return {
    isPending: false,
    mutate: mockCreateMutate,
  } as unknown as ReturnType<typeof useCreateApiToken>;
}

function asDeleteTokenMutation() {
  return {
    isPending: false,
    mutate: mockDeleteMutate,
  } as unknown as ReturnType<typeof useDeleteApiToken>;
}

function asUpdateTokenMutation() {
  return {
    isPending: false,
    mutate: mockUpdateTokenMutate,
  } as unknown as ReturnType<typeof useUpdateApiToken>;
}

function asCreateWebDavTokenMutation() {
  return {
    isPending: false,
    mutate: mockCreateWebDavMutate,
  } as unknown as ReturnType<typeof useCreateWebDavWizardToken>;
}

function mockAuthStore() {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: currentUser,
      token: "test-token",
      setAuth: vi.fn(),
      updateUser: mockUpdateUser,
      clearAuth: vi.fn(),
      isAuthenticated: () => true,
    }),
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mockAuthStore();
  vi.mocked(authService.sendEmailVerification).mockResolvedValue({
    message: "Verification sent",
  });
  vi.mocked(authService.checkProfileAvailability).mockResolvedValue({
    username_available: true,
    email_available: true,
  });
  vi.mocked(authService.updateProfile).mockResolvedValue({
    user: { ...currentUser, email: "alice+new@example.com" },
  });
  vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery([]));
  vi.mocked(useCreateApiToken).mockReturnValue(asCreateTokenMutation());
  vi.mocked(useCreateWebDavWizardToken).mockReturnValue(asCreateWebDavTokenMutation());
  vi.mocked(useDeleteApiToken).mockReturnValue(asDeleteTokenMutation());
  vi.mocked(useUpdateApiToken).mockReturnValue(asUpdateTokenMutation());
  vi.mocked(useWebDavActivity).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useWebDavActivity>);
  vi.mocked(useWebDavDiagnostics).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useWebDavDiagnostics>);
  vi.mocked(useStorageUsage).mockReturnValue({
    data: { total_size: 2048, file_count: 3 },
  } as unknown as ReturnType<typeof useStorageUsage>);
  vi.mocked(useOcrStatus).mockReturnValue({
    data: {
      enabled: false,
      pdf_max_pages: 5,
      tesseract: { bin: "tesseract", available: false },
      poppler: { bin: "pdftoppm", available: false },
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useOcrStatus>);
});

describe("Settings page regressions", () => {
  it("reveals email verification only when the profile email changes", async () => {
    render(<UserInfoSection />);

    expect(screen.queryByLabelText(/Verification code/i)).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Email/i));
    await userEvent.type(
      screen.getByLabelText(/Email/i),
      "alice+new@example.com",
    );

    expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument();
  });

  it("creates API tokens through the existing mutation contract", async () => {
    render(<ApiTokenSection />);

    await userEvent.type(screen.getByLabelText(/Token name/i), "CI token");
    await userEvent.type(screen.getByLabelText(/Expires in/i), "7");
    await userEvent.click(
      screen.getByRole("button", { name: /Create token/i }),
    );

    expect(mockCreateMutate).toHaveBeenCalledWith(
      {
        name: "CI token",
        expires_in_days: 7,
        webdav_enabled: true,
        webdav_read_only: false,
        webdav_root_folder_id: null,
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  it("keeps the custom WebDAV permission controls wired to token creation", async () => {
    render(<ApiTokenSection />);

    expect(screen.getByTestId("webdav-enabled-option")).toHaveClass(
      "neu-inset",
    );
    expect(screen.getByTestId("webdav-readonly-option")).toHaveClass(
      "neu-inset",
    );
    const enabledIndicator = screen
      .getByTestId("webdav-enabled-option")
      .querySelector(".settings-color-checkbox-indicator");

    expect(enabledIndicator).toHaveClass("settings-color-checkbox-indicator");
    expect(enabledIndicator).not.toHaveClass(
      "peer-checked:bg-[var(--neu-surface-bg-green)]",
      "peer-checked:shadow-[var(--neu-pressed-shadow)]",
    );
    expect(enabledIndicator?.querySelector("svg")).toBeNull();

    await userEvent.click(screen.getByLabelText(/WebDAV read-only/i));
    await userEvent.type(screen.getByLabelText(/Token name/i), "Read token");
    await userEvent.type(screen.getByLabelText(/Expires in/i), "30");
    await userEvent.click(
      screen.getByRole("button", { name: /Create token/i }),
    );

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Read token",
        expires_in_days: 30,
        webdav_enabled: true,
        webdav_read_only: true,
      }),
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  it("opens delete confirmation before deleting an existing token", async () => {
    const token: ApiToken = {
      id: "tok-1",
      name: "Deploy",
      created_at: "2026-05-04T00:00:00Z",
      last_used_at: null,
      expires_at: null,
      webdav_enabled: true,
      webdav_read_only: false,
      webdav_root_folder_id: null,
    };
    vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery([token]));

    render(<ApiTokenSection />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/i }));

    expect(screen.getByText(/Delete this token/i)).toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("edits WebDAV token metadata without exposing the token secret", async () => {
    const token: ApiToken = {
      id: "tok-1",
      name: "Old Finder",
      created_at: "2026-05-04T00:00:00Z",
      last_used_at: null,
      expires_at: null,
      webdav_enabled: true,
      webdav_read_only: false,
      webdav_root_folder_id: null,
    };
    vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery([token]));

    render(<ApiTokenSection />);

    await userEvent.click(screen.getByRole("button", { name: /Edit Old Finder/i }));
    await userEvent.clear(screen.getByLabelText(/Edit token name/i));
    await userEvent.type(screen.getByLabelText(/Edit token name/i), "iPhone Files");
    await userEvent.click(screen.getByLabelText(/Edit WebDAV read-only/i));
    await userEvent.click(screen.getByRole("button", { name: /Save token changes/i }));

    expect(mockUpdateTokenMutate).toHaveBeenCalledWith(
      {
        tokenId: "tok-1",
        data: {
          name: "iPhone Files",
          webdav_enabled: true,
          webdav_read_only: true,
          webdav_root_folder_id: null,
        },
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
    expect(screen.queryByText("secret-webdav-token")).not.toBeInTheDocument();
  });

  it("collapses existing tokens after five items inside a scrollable frame", async () => {
    const tokens: ApiToken[] = Array.from({ length: 7 }, (_, index) => ({
      id: `tok-${index + 1}`,
      name: `Token ${index + 1}`,
      created_at: "2026-05-04T00:00:00Z",
      last_used_at: null,
      expires_at: null,
      webdav_enabled: true,
      webdav_read_only: false,
      webdav_root_folder_id: null,
    }));
    vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery(tokens));

    render(<ApiTokenSection />);

    const frame = screen.getByTestId("existing-token-list-frame");
    const collapsedRow = screen.getByTestId("existing-token-collapse-row");
    const collapsedSummary = screen.getByTestId("existing-token-collapse-summary");
    const collapsedToggle = screen.getByRole("button", { name: /Show all 7 tokens/i });

    expect(collapsedRow).toHaveClass("flex-row", "items-center", "justify-between");
    expect(collapsedRow).not.toHaveClass("flex-col");
    expect(collapsedSummary).toHaveClass("min-w-0", "truncate");
    expect(collapsedToggle).toHaveClass(
      "existingTokenNeuButton",
      "shrink-0",
      "whitespace-nowrap",
    );
    expect(collapsedToggle).toHaveClass("settings-neu-raised-button");
    expect(collapsedToggle).toHaveClass("neu-raised-sm");
    expect(frame).toHaveClass("max-h-[clamp(22rem,55dvh,34rem)]", "overflow-y-auto");
    expect(frame).toHaveClass("existingTokenInsetFrame", "settings-neu-inset-panel");
    expect(frame).toHaveClass("neu-inset");
    expect(screen.getByText("Token 1")).toBeInTheDocument();
    expect(screen.getByText("Token 5")).toBeInTheDocument();
    expect(screen.queryByText("Token 6")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 5 of 7 tokens/i)).toBeInTheDocument();

    await userEvent.click(collapsedToggle);

    expect(screen.getByText("Token 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show less/i })).toBeInTheDocument();
  });

  it("keeps existing API token rows mobile-safe before switching to desktop metadata columns", () => {
    const token: ApiToken = {
      id: "tok-1",
      name: "Mobile sync token with a long descriptive name",
      created_at: "2026-05-04T00:00:00Z",
      last_used_at: null,
      expires_at: null,
      webdav_enabled: true,
      webdav_read_only: false,
      webdav_root_folder_id: "11111111-1111-4111-8111-111111111111",
    };
    vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery([token]));

    render(<ApiTokenSection />);

    expect(screen.getByTestId("existing-token-row-tok-1")).toHaveClass(
      "existingTokenInsetRow",
      "settings-neu-inset-panel",
      "neu-inset",
      "overflow-hidden",
    );
    expect(screen.getByTestId("existing-token-main-row-tok-1")).toHaveClass(
      "flex-col",
      "items-stretch",
      "sm:flex-row",
      "sm:items-start",
    );
    expect(screen.getByTestId("existing-token-meta-grid-tok-1")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
    );
    expect(screen.getByRole("button", { name: /Delete Mobile sync token/i })).toHaveClass(
      "existingTokenFlatAction",
      "existingTokenFlatAction--delete",
      "w-full",
      "px-[clamp(0.58rem,1.35vw,0.74rem)]",
      "py-[clamp(0.3rem,0.78vw,0.4rem)]",
      "text-[length:var(--settings-text-xs)]",
      "sm:w-auto",
    );
    expect(screen.getByRole("button", { name: /Delete Mobile sync token/i })).not.toHaveClass(
      "existingTokenNeuAction--danger",
      "shadow-[var(--settings-secondary-shadow)]",
      "shadow-[var(--neu-control-shadow)]",
      "border",
    );
    expect(screen.getByRole("button", { name: /Edit Mobile sync token/i })).toHaveClass(
      "existingTokenFlatAction",
      "existingTokenFlatAction--edit",
      "w-full",
      "px-[clamp(0.58rem,1.35vw,0.74rem)]",
      "py-[clamp(0.3rem,0.78vw,0.4rem)]",
      "text-[length:var(--settings-text-xs)]",
      "sm:w-auto",
    );
    expect(screen.getByRole("button", { name: /Edit Mobile sync token/i })).not.toHaveClass(
      "settings-neu-raised-button",
      "shadow-[var(--settings-secondary-shadow)]",
      "border",
    );
    const source = readFileSync(
      resolve(__dirname, "../../styles/base.css"),
      "utf8",
    );
    const tokenRowRule =
      source.match(/\.existingTokenInsetRow\s*\{[^}]*\}/)?.[0] ?? "";

    expect(tokenRowRule).toContain(
      "background: var(--neu-inset-bg) !important;",
    );
    expect(tokenRowRule).toContain(
      "box-shadow: var(--neu-inset-shadow) !important;",
    );
    expect(tokenRowRule).not.toContain("flat-reference-green-surface-bg");
    expect(source).toContain("--existing-token-action-edit-bg: #22c55e;");
    expect(source).toContain("--existing-token-action-delete-bg: #ef4444;");
    expect(source).toContain(".existingTokenFlatAction {");
    expect(source).toContain(".existingTokenFlatAction--edit {");
    expect(source).toContain(".existingTokenFlatAction--delete {");
    expect(source).toContain(".peer:checked + .settings-color-checkbox-indicator");
    expect(source).toContain("box-shadow: none !important;");
    expect(source).not.toContain(".existingTokenNeuAction--danger");
  });

  it("uses semantic settings tokens for error input states", () => {
    expect(settingsInputClass(true)).toContain("settings-form-error");
    expect(settingsInputClass(false)).toContain("neu-inset");
    expect(settingsInputClass(false)).not.toContain("settings-form-input-border");
    expect(settingsInputClass(false)).not.toContain("[background:var(--settings-form-input-bg)]");
  });

  it("maps Settings form controls to the CodePen neuromorphic inset and raised primitives", () => {
    expect(settingsInputClass(false)).toContain("settings-neu-inset-control");
    expect(settingsInputClass(false)).toContain("neu-inset");
    expect(settingsInputClass(false)).toContain(
      "focus:shadow-[var(--neu-pressed-shadow)]",
    );

    expect(settingsPanelClass()).toContain("settings-neu-inset-panel");
    expect(settingsPanelClass()).toContain("neu-inset");
    expect(settingsPanelClass()).not.toContain("[background:var(--neu-inset-bg)]");
    expect(settingsPanelClass()).toContain("border-0");

    expect(settingsSecondaryButtonClass()).toContain("settings-neu-raised-button");
    expect(settingsSecondaryButtonClass()).toContain("neu-raised-sm");
    expect(settingsSecondaryButtonClass()).not.toContain("[background:var(--settings-secondary-bg)]");

    expect(settingsPrimaryButtonClass()).toContain("settings-neu-primary-button");
    expect(settingsPrimaryButtonClass()).toContain("neu-raised-green");
    expect(settingsPrimaryButtonClass()).not.toContain("[background:var(--settings-action-bg)]");
    expect(settingsPrimaryButtonClass()).toContain(
      "active:shadow-[var(--neu-pressed-shadow)]",
    );
    expect(settingsPrimaryButtonClass()).toContain("inline-flex");
    expect(settingsPrimaryButtonClass()).toContain("min-w-0");
    expect(settingsPrimaryButtonClass()).toContain("whitespace-nowrap");
  });

  it("returns to the remembered files folder instead of browser history", async () => {
    window.sessionStorage.setItem("settings-return-to", "/files?folder=folder-1");

    render(
      <MemoryRouter
        initialEntries={["/shares", "/settings"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/shares" element={<LocationProbe />} />
          <Route path="/files" element={<LocationProbe />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/files?folder=folder-1",
    );
  });

  it("does not send Settings back to the Share Center when no files folder is remembered", async () => {
    render(
      <MemoryRouter
        initialEntries={["/shares", "/settings"]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/shares" element={<LocationProbe />} />
          <Route path="/files" element={<LocationProbe />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/files");
  });

  it("falls back to files home when there is no previous app route", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/files" element={<LocationProbe />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/files");
  });

  it("does not render Settings quick nav links", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Quick nav")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jump to Account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jump to Storage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jump to Appearance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jump to Security/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Jump to Tokens/i })).not.toBeInTheDocument();
  });

  it("keeps the top nav Settings button visible after navigating into the Settings page", async () => {
    render(
      <MemoryRouter initialEntries={["/files"]}>
        <Routes>
          <Route
            path="/files"
            element={
              <PageLayout title="FILES" username={currentUser.username} onLogout={vi.fn()}>
                <div>Files home</div>
              </PageLayout>
            }
          />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(
      screen.getByRole("heading", { name: "Settings Center" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not render the Appearance section on the Settings page", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("heading", { name: "Appearance" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Classic purple theme/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the Settings Center header outside the redesigned content groups", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    const cardGrid = screen.getByTestId("settings-card-grid");

    expect(cardGrid).toHaveClass("grid");
    expect(cardGrid).not.toHaveTextContent("Settings Center");
    expect(cardGrid).toHaveTextContent("Account");
    expect(cardGrid).toHaveTextContent("Storage");
    expect(cardGrid).toHaveTextContent("Security");
    expect(cardGrid).toHaveTextContent("WebDAV Access");
    expect(cardGrid).toHaveTextContent("OCR Status");
    expect(cardGrid).toHaveTextContent("API Tokens");
  });

  it("adds Settings visual polish without changing the content layout", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("settings-hero-panel")).toHaveClass(
      "isolate",
      "settings-neu-raised-card",
      "neu-raised",
      "transition-[box-shadow]",
    );

    const settingsCards = screen.getAllByTestId("settings-card-shell");
    expect(settingsCards).toHaveLength(6);
    expect(settingsCards[0]).toHaveClass(
      "group/settings-card",
      "settings-neu-raised-card",
      "neu-raised",
      "transition-[box-shadow,transform]",
    );
    expect(screen.getByTestId("settings-card-grid")).toHaveTextContent(
      /Account[\s\S]*Security[\s\S]*WebDAV Access[\s\S]*API Tokens[\s\S]*OCR Status[\s\S]*Storage/,
    );
  });

  it("uses global primitives for Settings surfaces and primary actions", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("settings-hero-panel")).toHaveClass(
      "neu-raised",
    );
    expect(screen.getAllByTestId("settings-card-shell")[0]).toHaveClass(
      "neu-raised",
    );

    const primaryButtonClass = settingsPrimaryButtonClass();
    expect(primaryButtonClass).toContain("neu-raised-green");
    expect(primaryButtonClass).not.toContain("[background:var(--settings-action-bg)]");
    expect(primaryButtonClass).not.toContain(
      "hover:[background:var(--settings-action-bg-hover)]",
    );
    expect(primaryButtonClass).not.toContain("bg-[var(--settings-action-bg)]");
  });

  it("uses focused Settings layout groups instead of forcing every pair equal height", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    const identityGroup = screen.getByTestId("settings-group-identity");
    const webdavFocus = screen.getByTestId("settings-group-webdav-focus");
    const tokenWorkspace = screen.getByTestId("settings-group-token-workspace");
    const statusGroup = screen.getByTestId("settings-group-status");

    expect(identityGroup).toHaveClass("xl:grid-cols-2", "xl:items-stretch");
    expect(webdavFocus).toHaveClass(
      "xl:[&>section]:p-[clamp(1.35rem,2.8vw,1.75rem)]",
    );
    expect(tokenWorkspace).toHaveClass(
      "xl:[&>section]:p-[clamp(1.35rem,2.8vw,1.75rem)]",
    );
    expect(statusGroup).toHaveClass("lg:grid-cols-2", "lg:items-stretch");
    expect(identityGroup).toHaveTextContent(/Account[\s\S]*Security/);
    expect(webdavFocus).toHaveTextContent("WebDAV Access");
    expect(tokenWorkspace).toHaveTextContent("API Tokens");
    expect(statusGroup).toHaveTextContent(/OCR Status[\s\S]*Storage/);
    expect(
      screen.queryByTestId("settings-card-row-webdav-tokens"),
    ).not.toBeInTheDocument();
  });

  it("aligns first-row form actions and stretches the bottom status row", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("settings-account-column")).toHaveClass(
      "[&>section]:h-full",
    );
    expect(screen.getByTestId("settings-security-column")).toHaveClass(
      "[&>section]:h-full",
    );
    expect(screen.getByTestId("settings-account-actions")).toHaveClass(
      "mt-auto",
    );
    expect(screen.getByTestId("settings-security-actions")).toHaveClass(
      "mt-auto",
    );
    expect(screen.getByTestId("settings-ocr-column")).toHaveClass(
      "[&>section]:h-full",
    );
    expect(screen.getByTestId("settings-storage-column")).toHaveClass(
      "[&>section]:h-full",
    );
  });

  it("keeps account feedback stacked above the form instead of sharing a row", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("No changes made");
    });
    expect(screen.getByTestId("settings-account-column")).toHaveClass(
      "[&>section>div:last-child]:flex-col",
    );
  });

  it("keeps Settings actions and summary tiles on fluid widths instead of fixed minimums", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("settings-page-shell")).toHaveClass(
      "w-full",
      "max-w-[var(--app-shell-max-width)]",
      "min-w-0",
    );
    expect(screen.getByTestId("settings-hero-layout")).toHaveClass("lg:flex-row");
    expect(screen.getByTestId("settings-hero-summary-grid")).toHaveClass(
      "grid-cols-[repeat(auto-fit,minmax(var(--settings-hero-summary-tile-min),1fr))]",
      "w-full",
      "lg:w-[var(--settings-hero-summary-inline-size)]",
    );

    const getCodeButton = screen.getByRole("button", { name: /Get code/i });
    expect(getCodeButton).toHaveClass("w-full", "sm:w-auto");
    expect(getCodeButton).not.toHaveClass("sm:min-w-[6.5rem]");

    const saveButton = screen.getByRole("button", { name: /Save/i });
    const changePasswordButton = screen.getByRole("button", {
      name: /Change password/i,
    });
    const createTokenButton = screen.getByRole("button", { name: /Create token/i });

    expect(saveButton).toHaveClass("w-full", "md:w-auto");
    expect(saveButton).not.toHaveClass("sm:min-w-[8rem]");
    expect(changePasswordButton).toHaveClass("w-full", "md:w-auto");
    expect(changePasswordButton).not.toHaveClass("sm:min-w-[10rem]");
    expect(createTokenButton).toHaveClass("w-full", "md:w-auto");
    expect(createTokenButton).not.toHaveClass("sm:min-w-[10rem]");

    const shareButton = screen.getByRole("button", { name: /Manage Shares/i });
    const shareActions = screen.getByTestId("settings-share-center-actions");
    expect(shareActions).toHaveClass("flex", "w-full", "md:justify-end", "lg:w-auto");
    expect(shareButton.className).toBe(createTokenButton.className);
    expect(shareButton).toHaveClass("w-full", "md:w-auto");
    expect(shareButton).toHaveClass(
      "settings-neu-primary-button",
      "neu-raised-green",
    );
    expect(shareButton).not.toHaveClass(
      "settings-neu-raised-button",
      "[background:var(--settings-secondary-bg)]",
      "shadow-[var(--settings-secondary-shadow)]",
      "h-[3rem]",
      "w-[12rem]",
      "min-w-[12rem]",
      "lg:min-w-[12rem]",
    );
    expect(shareButton.querySelector("svg")).toBeNull();
  });

  it("keeps Settings runtime sizing fluid instead of component-local fixed rem or px values", () => {
    expect(findSettingsFixedSizingOffenders()).toEqual([]);
  });

  it("keeps the Registered title outside a value box aligned with confirm password", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    const registeredField = screen.getByTestId("settings-registered-field");
    const registeredTitle = screen.getByText("Registered");
    const registeredValueBox = screen.getByTestId("settings-registered-value");

    expect(registeredField.firstElementChild).toBe(registeredTitle);
    expect(registeredField).toHaveClass(
      "xl:mt-[calc(clamp(0.195rem,0.45vw,0.25rem)+0.8lh)]",
    );
    expect(registeredTitle).toHaveClass(...settingsLabelClass().split(" "));
    expect(registeredValueBox).not.toHaveTextContent("Registered");
    expect(registeredValueBox).toHaveTextContent("5/4/2026");
    expect(registeredValueBox).toHaveClass(
      "settings-neu-inset-panel",
      "px-[clamp(0.78rem,1.8vw,1rem)]",
      "py-[clamp(0.4875rem,1.125vw,0.625rem)]",
      "text-[length:var(--settings-text-md)]",
    );
  });

  it("returns home only from the title icon", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/files" element={<LocationProbe />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Go to files home/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/files");
  });

  it("shows WebDAV access guidance without rendering a real token", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("WebDAV Access")).toBeInTheDocument();
    expect(screen.getByText("Connection details")).toBeInTheDocument();
    expect(screen.getByText("Credential mapping")).toBeInTheDocument();
    expect(screen.getByText("Setup order")).toBeInTheDocument();
    expect(screen.getByText("Client notes")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3000/dav")).toBeInTheDocument();
    expect(screen.getByText(/Password maps to an API Token/i)).toBeInTheDocument();
    expect(screen.getByText(/Open your WebDAV client/i)).toBeInTheDocument();
    expect(screen.getByText("Finder")).toBeInTheDocument();
    expect(screen.getByText("rclone")).toBeInTheDocument();
    expect(screen.queryByText("test-token")).not.toBeInTheDocument();
  });

  it("keeps WebDAV panels readable in the full-width focused Settings section", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("webdav-access-grid")).toHaveClass(
      "grid",
    );
    expect(screen.getByTestId("webdav-guidance-grid")).toHaveClass(
      "lg:grid-cols-3",
    );
    expect(screen.getByTestId("webdav-connection-panel")).not.toHaveClass(
      "h-full",
    );
    expect(screen.getByTestId("webdav-setup-panel")).toHaveClass(
      "h-full",
    );
    expect(screen.getByTestId("webdav-credentials-panel")).toHaveClass(
      "h-full",
    );
    expect(screen.getByTestId("webdav-clients-panel")).toHaveClass(
      "h-full",
    );
  });
});
