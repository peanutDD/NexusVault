# Settings Page Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Settings page visual polish and low-risk usability while preserving existing profile, storage, theme, password, and API token behavior.

**Architecture:** Keep behavior inside existing Settings sections. Add a tiny settings-local UI helper for repeated field/error/action styling, then apply it conservatively to sections that currently duplicate fragile class strings. Do not modify backend services, API hooks, auth store, or route contracts.

**Tech Stack:** React 19, TypeScript, React Hook Form, Zod, Zustand, TanStack Query hooks, Vitest, React Testing Library, Tailwind/semantic CSS tokens.

---

## File Structure

- Modify: `frontend/src/pages/Settings.tsx`
  - Add section metadata for quick nav.
  - Use safer responsive layout classes for header KPIs and quick nav.
- Create: `frontend/src/components/settings/settingsUi.ts`
  - Export reusable class builders for settings inputs, labels, help/error text, primary buttons, secondary buttons, and panel shells.
- Modify: `frontend/src/components/settings/UserInfoSection.tsx`
  - Replace repeated field/button classes with helper functions.
  - Preserve form registration, validation schema, email code behavior, and service calls.
  - Make email/code row wrap cleanly on mobile.
- Modify: `frontend/src/components/settings/PasswordChangeSection.tsx`
  - Replace repeated classes with helper functions.
  - Preserve validation and submit behavior.
- Modify: `frontend/src/components/settings/ApiTokenSection.tsx`
  - Replace repeated classes with helper functions.
  - Improve token create header wrapping and empty/loading visual state.
  - Preserve create, copy, one-time display, and delete confirmation behavior.
- Modify: `frontend/src/components/settings/ThemeSection.tsx`
  - Improve selected state readability and keep `setTheme(opt.value)` unchanged.
- Test: `frontend/src/components/settings/SettingsPageRegression.test.tsx`
  - Cover theme selection, profile email verification field reveal, API token create/delete UI behavior, and key layout classes.
- Modify: `.gitignore`
  - Ignore `.superpowers/` visual companion artifacts.

## Task 1: Add Settings UI Helper And Regression Tests

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/settings/SettingsPageRegression.test.tsx` with tests that mock the stores/hooks/services and assert current critical behavior:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ThemeSection from "./ThemeSection";
import UserInfoSection from "./UserInfoSection";
import ApiTokenSection from "./ApiTokenSection";
import { useThemeStore } from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";
import { authService } from "../../services/auth";
import {
  useApiTokens,
  useCreateApiToken,
  useDeleteApiToken,
} from "../../hooks/useApiTokens";

vi.mock("../../store/themeStore");
vi.mock("../../store/authStore");
vi.mock("../../services/auth");
vi.mock("../../hooks/useApiTokens");
vi.mock("../../hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: vi.fn().mockResolvedValue(true) }),
}));

const mockSetTheme = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useThemeStore).mockReturnValue({
    theme: "dark",
    effectiveTheme: "dark",
    setTheme: mockSetTheme,
  } as ReturnType<typeof useThemeStore>);
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
        created_at: "2026-05-04T00:00:00Z",
      },
      token: "test-token",
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
      updateUser: mockUpdateUser,
      isAuthenticated: true,
    }),
  );
  vi.mocked(authService.sendEmailVerification).mockResolvedValue(undefined);
  vi.mocked(authService.checkProfileAvailability).mockResolvedValue({
    username_available: true,
    email_available: true,
  });
  vi.mocked(authService.updateProfile).mockResolvedValue({
    user: {
      id: "user-1",
      username: "alice",
      email: "alice+new@example.com",
      created_at: "2026-05-04T00:00:00Z",
    },
  });
  vi.mocked(useApiTokens).mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useApiTokens>);
  vi.mocked(useCreateApiToken).mockReturnValue({
    isPending: false,
    mutate: mockCreateMutate,
  } as ReturnType<typeof useCreateApiToken>);
  vi.mocked(useDeleteApiToken).mockReturnValue({
    isPending: false,
    mutate: mockDeleteMutate,
  } as ReturnType<typeof useDeleteApiToken>);
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
    await userEvent.type(screen.getByLabelText(/Email/i), "alice+new@example.com");
    expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument();
  });

  it("creates API tokens through the existing mutation contract", async () => {
    render(<ApiTokenSection />);
    await userEvent.type(screen.getByLabelText(/Token name/i), "CI token");
    await userEvent.type(screen.getByLabelText(/Expires in/i), "7");
    await userEvent.click(screen.getByRole("button", { name: /Create token/i }));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { name: "CI token", expires_in_days: 7 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("opens delete confirmation before deleting an existing token", async () => {
    vi.mocked(useApiTokens).mockReturnValue({
      data: [
        {
          id: "tok-1",
          name: "Deploy",
          created_at: "2026-05-04T00:00:00Z",
          last_used_at: null,
          expires_at: null,
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useApiTokens>);
    render(<ApiTokenSection />);
    await userEvent.click(screen.getByRole("button", { name: /Delete/i }));
    expect(screen.getByText(/Delete this token/i)).toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify red**

Run:

```bash
cd frontend
npm run test -- src/components/settings/SettingsPageRegression.test.tsx
```

Expected: FAIL because `settingsUi.ts` does not exist yet or because the new assertions expose current layout/contract gaps.

- [ ] **Step 3: Add the helper**

Create `frontend/src/components/settings/settingsUi.ts`:

```ts
import { cn } from "../../utils/cn";

export function settingsLabelClass(className?: string) {
  return cn(
    "font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2",
    className,
  );
}

export function settingsInputClass(hasError?: boolean, className?: string) {
  return cn(
    "w-full rounded-xl px-4 py-2.5 min-w-0",
    "bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]",
    "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]",
    hasError && "border-[var(--settings-form-error)] focus:ring-[var(--settings-form-error)]",
    className,
  );
}

export function settingsErrorClass(className?: string) {
  return cn(
    "font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-error)]",
    className,
  );
}

export function settingsHelperClass(className?: string) {
  return cn(
    "font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-form-helper)]",
    className,
  );
}

export function settingsPrimaryButtonClass(className?: string) {
  return cn(
    "font-brand rounded-xl px-4 py-2.5 font-semibold tracking-wide",
    "border border-[var(--settings-action-border)] bg-[var(--settings-action-bg)] text-[var(--settings-action-text)] shadow-[var(--settings-action-shadow)]",
    "hover:bg-[image:var(--settings-action-bg-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsSecondaryButtonClass(className?: string) {
  return cn(
    "font-brand rounded-xl px-4 py-2.5 text-[length:var(--settings-text-sm)] font-semibold tracking-wide",
    "border border-[var(--settings-secondary-border)] bg-[var(--settings-secondary-bg)] text-[var(--settings-secondary-text)]",
    "hover:bg-[var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    className,
  );
}

export function settingsPanelClass(className?: string) {
  return cn(
    "rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4",
    className,
  );
}
```

- [ ] **Step 4: Run helper test again**

Run:

```bash
cd frontend
npm run test -- src/components/settings/SettingsPageRegression.test.tsx
```

Expected: Remaining failures point to component markup changes, not missing helper file.

## Task 2: Apply Conservative UI Polish

- [ ] **Step 1: Update Settings sections**

Use `settingsUi.ts` in `UserInfoSection.tsx`, `PasswordChangeSection.tsx`, and `ApiTokenSection.tsx`. Replace duplicated class strings only. Preserve every `register(...)`, `handleSubmit(...)`, mutation call, and service payload.

- [ ] **Step 2: Improve mobile wrapping**

In `UserInfoSection.tsx`, change the email input/button wrapper to:

```tsx
<div className="flex flex-col gap-2 sm:flex-row" data-oid="wvivq7f">
```

Set the email input class with `settingsInputClass(Boolean(errors.email), "sm:flex-1")`.

In `ApiTokenSection.tsx`, change the create-token heading wrapper to allow wrapping:

```tsx
<div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
```

- [ ] **Step 3: Improve quick nav and header scanning**

In `Settings.tsx`, replace repeated quick-nav anchors with a section array:

```tsx
const SETTINGS_SECTIONS = [
  { href: "#profile", label: "Account" },
  { href: "#storage", label: "Storage" },
  { href: "#appearance", label: "Appearance" },
  { href: "#security", label: "Security" },
  { href: "#api-tokens", label: "Tokens" },
];
```

Render anchors from that array with consistent chip classes and `aria-label={`Jump to ${section.label}`}`.

- [ ] **Step 4: Verify green for focused tests**

Run:

```bash
cd frontend
npm run test -- src/components/settings/SettingsPageRegression.test.tsx
```

Expected: PASS.

## Task 3: Full Verification And Visual Check

- [ ] **Step 1: Run frontend unit tests**

Run:

```bash
cd frontend
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
cd frontend
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run token scan**

Run:

```bash
cd frontend
npm run check:tokens:strict
```

Expected: PASS or only pre-existing unrelated findings documented with exact output.

- [ ] **Step 4: Run production build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Visual verification**

Run the dev server:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open `/settings?debugAlerts=1` in the in-app browser at desktop and mobile viewport widths. Verify no overlapping controls, no clipped quick nav labels, no email button squeeze, and no token header collision.

## Self-Review

- Spec coverage: visual hierarchy, mobile wrapping, semantic token consistency, quick nav, and behavior preservation are each mapped to tasks.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: helper names and test imports are consistent across tasks.
