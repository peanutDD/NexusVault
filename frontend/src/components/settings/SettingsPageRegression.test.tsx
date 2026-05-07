import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { User } from "../../types/auth";
import type { ApiToken } from "../../services/apiTokens";
import Settings from "../../pages/Settings";
import ThemeSection from "./ThemeSection";
import UserInfoSection from "./UserInfoSection";
import ApiTokenSection from "./ApiTokenSection";
import { settingsInputClass } from "./settingsUi";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/auth";
import {
  useApiTokens,
  useCreateApiToken,
  useDeleteApiToken,
} from "../../hooks/useApiTokens";
import { useStorageUsage } from "../../hooks/useStorageUsage";

vi.mock("../../store/themeStore", () => ({
  useThemeStore: vi.fn(),
}));

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
  useDeleteApiToken: vi.fn(),
}));

vi.mock("../../hooks/useStorageUsage", () => ({
  useStorageUsage: vi.fn(),
}));

vi.mock("../../hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

const mockSetTheme = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

const currentUser: User = {
  id: "user-1",
  username: "alice",
  email: "alice@example.com",
  created_at: "2026-05-04T00:00:00Z",
};

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
  vi.mocked(useThemeStore).mockReturnValue({
    theme: "dark",
    effectiveTheme: "dark",
    setTheme: mockSetTheme,
    toggleTheme: vi.fn(),
  });
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
  vi.mocked(useDeleteApiToken).mockReturnValue(asDeleteTokenMutation());
  vi.mocked(useStorageUsage).mockReturnValue({
    data: { total_size: 2048, file_count: 3 },
  } as unknown as ReturnType<typeof useStorageUsage>);
});

describe("Settings page regressions", () => {
  it("keeps theme selection wired to the theme store", async () => {
    render(<ThemeSection />);

    await userEvent.click(screen.getByRole("button", { name: /Light/i }));

    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

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
      { name: "CI token", expires_in_days: 7 },
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
    };
    vi.mocked(useApiTokens).mockReturnValue(asApiTokensQuery([token]));

    render(<ApiTokenSection />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/i }));

    expect(screen.getByText(/Delete this token/i)).toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("uses semantic settings tokens for error input states", () => {
    expect(settingsInputClass(true)).toContain("settings-form-error");
    expect(settingsInputClass(false)).toContain("settings-form-input-border");
  });

  it("returns to the previous route instead of hardcoding files home", async () => {
    render(
      <MemoryRouter
        initialEntries={["/files?folder=folder-1", "/settings"]}
        initialIndex={1}
      >
        <Routes>
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
});
