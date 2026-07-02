import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Activity from "./Activity";
import { activityService, type ActivityEvent } from "../services/activity";
import { useAuthStore } from "../store/authStore";

vi.mock("../components/layout/PageLayout", () => ({
  default: ({
    children,
    backTo,
  }: {
    children: React.ReactNode;
    backTo?: { path: string; label: string };
  }) => (
    <main
      data-testid="page-layout"
      data-back-to-label={backTo?.label ?? ""}
      data-back-to-path={backTo?.path ?? ""}
    >
      {children}
    </main>
  ),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../services/activity", () => ({
  activityService: {
    list: vi.fn(),
  },
}));

function renderActivity({
  staleTime = 0,
}: {
  staleTime?: number;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/activity"]}>
        <Activity />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function buildActivityEvent(
  index: number,
  overrides: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id: `event-${index}`,
    user_id: "user-1",
    actor_type: "user",
    actor_user_id: "user-1",
    source: "web",
    event_type: "file.uploaded",
    target_type: "file",
    file_id: `file-${index}`,
    folder_id: null,
    share_id: null,
    file_request_id: null,
    api_token_id: null,
    status: 200,
    ip_address: "127.0.0.1",
    user_agent: "vitest",
    metadata: { filename: `audit-${index}.md` },
    created_at: `2026-05-24T10:${String(index).padStart(2, "0")}:00Z`,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function listFixedRemArbitraryUtilities(source: string) {
  return Array.from(source.matchAll(/\[[^\]]*rem[^\]]*\]/g), (match) => match[0]).filter(
    (token) => {
      const stripped = token
        .replace(/clamp\([^)]*\)/g, "")
        .replace(/var\([^)]*\)/g, "")
        .replace(/calc\(/g, "")
        .replace(/[()[\]\s*+\-/,:]/g, "");
      return /\d+(?:\.\d+)?rem/.test(stripped);
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: { id: "user-1", username: "alice" },
      clearAuth: vi.fn(),
    } as never),
  );
  vi.mocked(activityService.list).mockResolvedValue({
    events: [buildActivityEvent(1, { metadata: { filename: "brief.md" } })],
    next_cursor: "cursor-2",
  });
});

describe("Activity page", () => {
  it("renders the personal audit center and applies filters", async () => {
    const user = userEvent.setup();
    renderActivity();

    await waitFor(() => {
      expect(activityService.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });
    expect(await screen.findByText("Audit Center")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-back-to-path",
      "",
    );
    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-back-to-label",
      "",
    );
    expect(
      screen.getByRole("button", { name: "返回上一级" }),
    ).toHaveAttribute("data-testid", "activity-page-back-button");
    expect(screen.queryByTestId("activity-hero-kicker")).not.toBeInTheDocument();
    expect(screen.queryByText("Personal audit")).not.toBeInTheDocument();
    expect(screen.getByTestId("activity-hero-title")).toHaveClass(
      "text-[var(--settings-panel-value)]",
    );
    expect(screen.getByTestId("activity-filter-title")).toHaveClass(
      "text-[var(--settings-panel-value)]",
    );
    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    expect(screen.getByTestId("activity-event-source-event-1")).toHaveTextContent(
      "Files",
    );
    expect(screen.getByTestId("activity-event-source-event-1")).toHaveClass(
      "neu-raised-sm",
      "activityFlatChip",
      "text-[var(--settings-action-text)]",
    );
    expect(screen.getByTestId("activity-event-source-event-1")).not.toHaveClass(
      "shadow-[var(--settings-panel-shadow)]",
      "shadow-none",
    );
    expect(screen.getByText("file.uploaded")).toBeInTheDocument();
    expect(screen.getByTestId("activity-hero-shell")).toHaveClass(
      "settings-neu-raised-card",
      "activityRaisedSurface",
    );
    expect(screen.getByTestId("activity-status-pill")).toHaveClass("activityFlatChip");
    expect(screen.getByTestId("activity-status-pill")).not.toHaveClass(
      "settings-neu-raised-button",
      "shadow-[var(--settings-panel-shadow)]",
    );
    expect(screen.getByText("1 events")).toHaveClass("activityFlatChip");
    expect(screen.getByText("1 events")).not.toHaveClass("shadow-none");
    expect(screen.getByText("0 filters")).toHaveClass("activityFlatChip");
    expect(screen.getByText("0 filters")).not.toHaveClass("shadow-none");
    expect(screen.queryByTestId("activity-hero-refresh-button")).not.toBeInTheDocument();
    const refreshButton = screen.getByRole("button", { name: "刷新" });
    expect(refreshButton).toHaveAttribute("data-testid", "activity-refresh-button");
    expect(screen.getByTestId("activity-timeline-actions")).toContainElement(
      refreshButton,
    );
    const sharedActionSizeClasses = [
      "activityTimelineFluidAction",
      "min-w-0",
      "px-[clamp(0.88rem,2.2vw,1.04rem)]",
      "py-[clamp(0.46rem,1.2vw,0.58rem)]",
    ];
    expect(refreshButton).toHaveClass(...sharedActionSizeClasses);
    expect(refreshButton).not.toHaveClass("min-w-[clamp(9rem,24vw,14rem)]");
    expect(refreshButton).toHaveClass(
      "activityFlatButton",
      "activityFlatRefreshButton",
      "bg-[#10B981]",
      "rounded-[clamp(1.2rem,3vw,1.45rem)]",
      "text-white",
    );
    expect(refreshButton).not.toHaveClass("shadow-none");
    expect(refreshButton).not.toHaveClass(
      "[background:var(--settings-panel-bg)]",
      "bg-[linear-gradient(180deg,#22c55e_0%,#16a34a_100%)]",
      "w-[clamp(6.35rem,15.66vw,7.29rem)]",
      "min-h-[clamp(2.35rem,5.8vw,2.7rem)]",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_clamp(0.52rem,1.6vw,0.86rem)_rgba(21,128,61,0.28)]",
    );
    const baseCss = readFileSync(resolve(__dirname, "../styles/base.css"), "utf8");
    const activityActionRule =
      baseCss.match(/\.activityTimelineFluidAction\s*\{[^}]*\}/)?.[0] ?? "";
    const activityRaisedSurfaceRule =
      baseCss.match(/\.activityFlatPanel,\s*\.activityRaisedSurface\s*\{[^}]*\}/)?.[0] ?? "";
    const activityInsetSurfaceRule =
      Array.from(
        baseCss.matchAll(/\.activityInsetSurface,\s*\.activityIdentityPanel\s*\{[^}]*\}/g),
        (match) => match[0],
      ).find((rule) => rule.includes("background")) ?? "";
    const activityControlRule =
      Array.from(
        baseCss.matchAll(/\.activityFlatChip,\s*\.activityFlatButton\s*\{[^}]*\}/g),
        (match) => match[0],
      ).find((rule) => rule.includes("box-shadow")) ?? "";
    const activityFilterRule =
      baseCss.match(/\.activityFilterFieldsShell\s*\{[^}]*\}/)?.[0] ?? "";
    const filterInsetControlRule =
      (
        baseCss.match(
          /\.activityFilterFieldsShell \.settings-neu-inset-control\s*\{[^}]*\}/,
        ) ?? [""]
      )[0];
    const filterMenuRule =
      (
        baseCss.match(
          /\.activityFilterFieldsShell \.settings-neu-raised-card\s*\{[^}]*\}/,
        ) ?? [""]
      )[0];
    expect(activityActionRule).toContain("flex: 1 1 auto;");
    expect(activityActionRule).toContain("inline-size: auto;");
    expect(activityActionRule).toContain("min-block-size: clamp(");
    expect(activityActionRule).toContain("max-inline-size: 100%;");
    expect(activityActionRule).not.toContain("9rem");
    expect(activityActionRule).not.toContain("11rem");
    expect(screen.getByTestId("activity-center-frame")).toHaveClass(
      "max-w-[clamp(20rem,94vw,80rem)]",
      "overflow-hidden",
    );
    expect(screen.getByTestId("activity-center-workspace")).toHaveClass(
      "lg:grid-cols-[minmax(clamp(15rem,28vw,18rem),0.36fr)_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("activity-filter-panel")).toHaveClass(
      "activityFlatPanel",
      "settings-neu-inset-panel",
    );
    expect(screen.getByTestId("activity-filter-panel")).not.toHaveClass("shadow-none");
    expect(activityRaisedSurfaceRule).toContain(
      "background: var(--neu-raised-bg) !important;",
    );
    expect(activityRaisedSurfaceRule).toContain(
      "box-shadow: var(--neu-raised-shadow) !important;",
    );
    expect(activityInsetSurfaceRule).toContain(
      "background: var(--neu-inset-bg) !important;",
    );
    expect(activityInsetSurfaceRule).toContain(
      "box-shadow: var(--neu-inset-shadow) !important;",
    );
    expect(activityControlRule).toContain(
      "box-shadow: var(--neu-raised-sm-shadow) !important;",
    );
    expect(activityControlRule).not.toContain("box-shadow: none");
    expect(screen.getByTestId("activity-filter-fields-shell")).toHaveClass(
      "neu-inset",
      "activityInsetSurface",
      "activityFilterFieldsShell",
      "rounded-[clamp(0.92rem,2.2vw,1rem)]",
    );
    expect(screen.getByTestId("activity-filter-fields-shell")).not.toHaveClass(
      "shadow-none",
    );
    expect(activityFilterRule).toContain(
      "--settings-form-input-bg: var(--neu-inset-bg);",
    );
    expect(activityFilterRule).toContain(
      "--settings-form-input-border: transparent;",
    );
    expect(activityFilterRule).toContain(
      "--settings-form-input-shadow: var(--neu-inset-shadow);",
    );
    expect(activityFilterRule).toContain(
      "--settings-form-input-shadow-focus: var(--neu-inset-shadow);",
    );
    expect(filterInsetControlRule).toContain(
      "box-shadow: var(--neu-inset-shadow) !important;",
    );
    expect(filterInsetControlRule).not.toContain("box-shadow: none");
    expect(filterMenuRule).toContain(
      "box-shadow: var(--neu-raised-shadow) !important;",
    );
    expect(filterMenuRule).not.toContain("box-shadow: none");
    expect(screen.getByTestId("activity-timeline-panel")).toHaveClass(
      "settings-neu-inset-panel",
      "activityFlatPanel",
    );
    expect(screen.getByTestId("activity-timeline-heading")).toHaveClass(
      "uppercase",
      "text-[var(--settings-chip-text)]",
    );
    expect(screen.getByTestId("activity-event-card-event-1")).toHaveClass(
      "settings-neu-inset-panel",
      "activityInsetSurface",
    );
    expect(screen.getByTestId("activity-event-card-event-1")).not.toHaveClass(
      "shadow-none",
    );
    expect(screen.getByTestId("activity-event-header-event-1")).toBeInTheDocument();
    expect(screen.getByTestId("activity-event-body-event-1")).toBeInTheDocument();
    expect(screen.getByTestId("activity-event-footer-event-1")).toHaveClass(
      "flex-col",
      "lg:grid",
      "lg:grid-cols-[minmax(0,1fr)_max-content]",
    );
    expect(screen.getByTestId("activity-event-type-event-1")).toHaveClass("truncate");
    expect(screen.getByTestId("activity-event-title-event-1")).toHaveClass("break-all");
    expect(screen.getByTestId("activity-event-identity-panel-event-1")).toHaveClass(
      "activityIdentityPanel",
    );
    expect(screen.getByTestId("activity-event-identity-event-1")).toHaveClass(
      "justify-items-start",
    );
    expect(screen.getByTestId("activity-event-identity-file-event-1")).toHaveClass(
      "w-full",
      "grid-cols-[auto_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("activity-event-identity-file-event-1").firstElementChild).toHaveClass(
      "activitySemanticBadge",
      "activitySemanticBadge--success",
    );
    expect(screen.queryByTestId("activity-event-identity-folder-event-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("activity-event-status-event-1")).toHaveClass(
      "activitySemanticBadge",
      "activitySemanticBadge--success",
    );
    expect(screen.getByTestId("activity-event-time-event-1")).toHaveClass("activityFlatChip", "w-fit", "self-start");
    expect(screen.getByTestId("activity-event-time-event-1")).not.toHaveClass(
      "shadow-none",
    );
    expect(screen.getByRole("button", { name: "清除筛选" })).toHaveClass(
      "activityFlatButton",
    );
    expect(screen.getByRole("button", { name: "清除筛选" })).not.toHaveClass(
      "shadow-none",
    );
    expect(screen.getByTestId("activity-source-trigger")).toHaveClass(
      "min-h-[clamp(2.5rem,5.8vw,2.75rem)]",
      "neu-inset",
    );
    expect(screen.getByTestId("activity-date-from-trigger")).toHaveClass(
      "min-h-[clamp(2.5rem,5.8vw,2.75rem)]",
      "neu-inset",
    );
    expect(screen.getByTestId("activity-event-type-trigger")).toHaveClass(
      "min-h-[clamp(2.5rem,5.8vw,2.75rem)]",
      "neu-inset",
    );
    expect(screen.getByTestId("activity-target-type-trigger")).toHaveClass(
      "min-h-[clamp(2.5rem,5.8vw,2.75rem)]",
      "neu-inset",
    );

    await user.click(screen.getByTestId("activity-source-trigger"));
    const sourceMenu = screen.getByTestId("activity-source-menu");
    expect(sourceMenu).toHaveClass("neuSelectFlatMenu");
    expect(sourceMenu).not.toHaveClass("neu-raised-sm");
    expect(screen.getByRole("option", { name: "全部来源" })).toHaveClass(
      "neuSelectOption",
      "neuSelectOptionSelected",
      "neuSelectOptionHoverable",
    );
    expect(screen.getByRole("option", { name: "Files" })).toHaveClass(
      "neuSelectOption",
      "neuSelectOptionIdle",
      "neuSelectOptionHoverable",
    );
    expect(screen.getByRole("option", { name: "Files" })).not.toHaveClass(
      "neu-raised-sm",
      "neu-pressed",
    );
    await user.click(screen.getByRole("option", { name: "Files" }));
    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "web" }),
      );
    });
    expect(screen.getByTestId("activity-active-filter-source")).toHaveTextContent(
      "Files",
    );

    await user.click(screen.getByTestId("activity-event-type-trigger"));
    expect(screen.getByTestId("activity-event-type-menu")).toHaveClass(
      "neuSelectFlatMenu",
    );
    expect(screen.getByTestId("activity-event-type-menu")).not.toHaveClass(
      "neu-raised-sm",
    );
    await user.click(screen.getByRole("option", { name: "file.uploaded" }));
    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ event_type: "file.uploaded" }),
      );
    });
    expect(screen.getByTestId("activity-active-filter-event-type")).toHaveTextContent(
      "file.uploaded",
    );

    await user.click(screen.getByTestId("activity-date-from-trigger"));
    expect(screen.getByTestId("activity-date-from-popover")).toHaveClass(
      "neu-raised",
    );
    await user.click(screen.getByTestId("activity-date-from-today"));
    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          date_from: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/,
          ),
        }),
      );
    });

    const loadMoreButton = screen.getByRole("button", { name: "加载更多" });
    await user.click(loadMoreButton);
    expect(screen.getByTestId("activity-timeline-actions")).toContainElement(
      loadMoreButton,
    );
    expect(screen.getByTestId("activity-timeline-actions")).toHaveClass(
      "items-stretch",
    );
    expect(loadMoreButton).toHaveClass(...sharedActionSizeClasses);
    expect(loadMoreButton).toHaveClass(
      "neu-raised-sm",
      "activityFlatButton",
      "rounded-full",
      "activityTimelineFluidAction",
    );
    expect(loadMoreButton).not.toHaveClass("shadow-none");
    expect(loadMoreButton).not.toHaveClass(
      "w-[clamp(6.35rem,15.66vw,7.29rem)]",
      "min-h-[clamp(2.35rem,5.8vw,2.7rem)]",
    );
    expect(loadMoreButton).toHaveAttribute("aria-label", "加载更多");
    expect(loadMoreButton).not.toHaveTextContent("加载更多");
    expect(loadMoreButton).not.toHaveTextContent("加载中");
    expect(screen.getByTestId("activity-load-more-dots")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getAllByTestId(/^activity-load-more-dot-/)).toHaveLength(3);
    expect(screen.getByTestId("activity-load-more-dot-1")).toHaveClass(
      "bg-white",
    );
    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: "cursor-2" }),
      );
    });
  });

  it("lets the timeline and cards grow with content instead of clipping to a fixed viewport", async () => {
    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: Array.from({ length: 8 }, (_, index) =>
        buildActivityEvent(index + 1),
      ),
      next_cursor: null,
    });

    renderActivity();

    expect(await screen.findByText("audit-1.md")).toBeInTheDocument();

    expect(screen.getByTestId("activity-timeline-panel")).not.toHaveClass(
      "min-h-[clamp(32rem,76vh,40rem)]",
      "lg:flex",
      "lg:flex-col",
      "overflow-hidden",
    );
    const viewport = screen.getByTestId("activity-timeline-list-viewport");
    expect(viewport).toHaveClass("overflow-visible");
    expect(viewport).not.toHaveClass(
      "max-h-[calc((clamp(9.4rem,12.6vw,10.2rem)*5)+(clamp(0.62rem,1.55vw,0.78rem)*4))]",
      "overflow-y-auto",
      "[scrollbar-gutter:stable]",
      "lg:flex-1",
    );
    expect(screen.getAllByTestId(/^activity-event-card-/)).toHaveLength(8);
    expect(screen.getByTestId("activity-event-card-event-1")).toHaveClass("grid");
    expect(screen.getByTestId("activity-event-card-event-1")).not.toHaveClass(
      "h-[clamp(9.4rem,12.6vw,10.2rem)]",
      "grid-rows-[auto_auto_minmax(0,1fr)]",
    );
  });

  it("shows an empty state when no activity exists", async () => {
    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: [],
      next_cursor: null,
    });

    renderActivity();

    expect(await screen.findByText("还没有活动记录")).toBeInTheDocument();
    expect(screen.getByTestId("activity-empty-state")).toHaveClass(
      "settings-neu-inset-panel",
    );
  });

  it("exposes complete target filters and formats backend status codes", async () => {
    const user = userEvent.setup();
    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: [
        buildActivityEvent(1, {
          source: "worker",
          event_type: "fulltext.indexed",
          target_type: "file",
          folder_id: "folder-1",
          share_id: "share-1",
          file_request_id: "request-1",
          api_token_id: "token-1",
          status: 202,
          metadata: { filename: "indexed.md" },
        }),
      ],
      next_cursor: null,
    });

    renderActivity();

    expect(await screen.findByText("indexed.md")).toBeInTheDocument();
    expect(screen.getByTestId("activity-event-source-event-1")).toHaveTextContent(
      "Worker",
    );
    expect(screen.getByTestId("activity-event-status-event-1")).toHaveTextContent(
      "202",
    );

    await user.click(screen.getByTestId("activity-source-trigger"));
    await user.click(screen.getByRole("option", { name: "Worker" }));
    await user.click(screen.getByTestId("activity-target-type-trigger"));
    await user.click(screen.getByRole("option", { name: "file" }));
    await user.type(screen.getByLabelText("文件夹 ID"), "folder-1");
    await user.type(screen.getByLabelText("分享 ID"), "share-1");
    await user.type(screen.getByLabelText("请求 ID"), "request-1");
    await user.type(screen.getByLabelText("Token ID"), "token-1");

    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          source: "worker",
          target_type: "file",
          folder_id: "folder-1",
          share_id: "share-1",
          file_request_id: "request-1",
          api_token_id: "token-1",
        }),
      );
    });
    expect(screen.getByTestId("activity-active-filter-target-type")).toHaveTextContent(
      "file",
    );
    expect(screen.getByTestId("activity-active-filter-api-token-id")).toHaveTextContent(
      "token-1",
    );
  });

  it("keeps invalid ID filters on the client instead of sending 400-producing requests", async () => {
    const user = userEvent.setup();
    renderActivity();

    expect(await screen.findByText("brief.md")).toBeInTheDocument();
    expect(activityService.list).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("文件 ID"), "111");

    expect(await screen.findByTestId("activity-filter-validation-state")).toHaveClass(
      "activityInsetSurface",
    );
    expect(screen.getByText("筛选条件需要调整")).toBeInTheDocument();
    expect(screen.getByText("文件 ID 需要以 file- 开头")).toBeInTheDocument();
    expect(screen.queryByText("活动记录加载失败")).not.toBeInTheDocument();
    expect(activityService.list).not.toHaveBeenCalledWith(
      expect.objectContaining({ file_id: "111" }),
    );
  });

  it("renders detailed neuromorphic guidance when the activity request fails", async () => {
    vi.mocked(activityService.list).mockRejectedValueOnce(new Error("Bad Request"));

    renderActivity();

    expect(await screen.findByText("活动记录加载失败")).toBeInTheDocument();
    expect(activityService.list).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("activity-error-state")).toHaveClass(
      "activityInsetSurface",
    );
    expect(screen.getByTestId("activity-error-icon")).toHaveClass(
      "activityErrorStateIcon",
    );
    expect(screen.getByText("请求被后端拒绝或网络暂时不可用。")).toBeInTheDocument();
    const errorState = screen.getByTestId("activity-error-state");
    const guidance = screen.getByTestId("activity-error-guidance");
    expect(guidance).toHaveClass(
      "neu-inset",
      "activityErrorGuidanceGroup",
      "justify-items-center",
    );
    expect(guidance).not.toHaveClass("sm:grid-cols-3");
    expect(screen.getByTestId("activity-error-guidance-item-1")).toHaveTextContent(
      "1、确认 ID 前缀和真实值匹配",
    );
    expect(screen.getByTestId("activity-error-guidance-item-2")).toHaveTextContent(
      "2、日期会按当天起止时间发送",
    );
    expect(screen.getByTestId("activity-error-guidance-item-3")).toHaveTextContent(
      "3、刷新不会改变当前筛选",
    );
    for (const issue of within(guidance).getAllByText(/、/)) {
      expect(issue).toHaveClass("activityErrorGuidanceItem");
      expect(issue).not.toHaveClass("activityErrorStateIssue");
    }
    for (const name of ["重新加载", "清除筛选"]) {
      expect(within(errorState).getByRole("button", { name })).toHaveClass(
        "activityFlatButton",
        "activityFlatRefreshButton",
        "activityTimelineFluidAction",
        "rounded-[clamp(1.2rem,3vw,1.45rem)]",
        "bg-[#10B981]",
        "text-white",
      );
    }
  });

  it("shows visible sync feedback when filters change and when refresh is running", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{
      events: ActivityEvent[];
      next_cursor: string | null;
    }>();

    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: [buildActivityEvent(1, { metadata: { filename: "brief.md" } })],
      next_cursor: null,
    });

    renderActivity();

    expect(await screen.findByText("brief.md")).toBeInTheDocument();

    await user.click(screen.getByTestId("activity-source-trigger"));
    await user.click(screen.getByRole("option", { name: "WebDAV" }));

    expect(screen.getByTestId("activity-active-filter-source")).toHaveTextContent(
      "WebDAV",
    );

    vi.mocked(activityService.list).mockImplementationOnce(() => deferred.promise);
    await user.click(screen.getByRole("button", { name: "刷新" }));

    await waitFor(() => {
      expect(screen.getAllByText("正在更新时间线...").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", { name: "刷新中..." }),
      ).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "刷新中..." })).toHaveClass(
      "activityFlatRefreshButton",
      "bg-[#10B981]",
      "text-white",
    );

    deferred.resolve({
      events: [buildActivityEvent(2, { source: "webdav" })],
      next_cursor: null,
    });

    expect(await screen.findByText("audit-2.md")).toBeInTheDocument();
  });

  it("refreshes with a ten-event visible window", async () => {
    const user = userEvent.setup();
    vi.mocked(activityService.list).mockImplementation(async (filters) => ({
      events: Array.from({ length: filters?.limit ?? 10 }, (_, index) =>
        buildActivityEvent(index + 1),
      ),
      next_cursor: "cursor-2",
    }));

    renderActivity();

    expect(await screen.findByText("audit-1.md")).toBeInTheDocument();
    expect(screen.getByText("10 visible")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新" }));

    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });
    expect(screen.getByText("10 visible")).toBeInTheDocument();
  });

  it("renders file and folder metadata inside a dedicated neuromorphic identity panel", async () => {
    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: [
        buildActivityEvent(1, {
          file_id: "file-1",
          folder_id: "folder-1",
          file_request_id: "request-1",
        }),
      ],
      next_cursor: null,
    });

    renderActivity();

    expect(await screen.findByText("audit-1.md")).toBeInTheDocument();
    expect(screen.getByTestId("activity-event-identity-panel-event-1")).toHaveClass(
      "activityIdentityPanel",
    );
    expect(screen.getByTestId("activity-event-identity-event-1")).toHaveClass(
      "justify-items-start",
    );
    expect(screen.getByTestId("activity-event-identity-file-event-1")).toHaveTextContent(
      "filefile-1",
    );
    expect(
      screen.getByTestId("activity-event-identity-folder-event-1"),
    ).toHaveTextContent("folderfolder-1");
    expect(
      screen.getByTestId("activity-event-identity-request-event-1"),
    ).toHaveTextContent("requestrequest-1");
  });

  it("restores cached all-source results after an empty share filter response", async () => {
    const user = userEvent.setup();
    renderActivity({ staleTime: 1000 * 60 * 5 });

    expect(await screen.findByText("brief.md")).toBeInTheDocument();

    vi.mocked(activityService.list).mockResolvedValueOnce({
      events: [],
      next_cursor: null,
    });
    await user.click(screen.getByTestId("activity-source-trigger"));
    await user.click(screen.getByRole("option", { name: "Shares" }));
    await waitFor(() => {
      expect(activityService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: "share" }),
      );
    });
    expect(await screen.findByText("还没有活动记录")).toBeInTheDocument();

    await user.click(screen.getByTestId("activity-source-trigger"));
    await user.click(screen.getByRole("option", { name: "全部来源" }));

    await waitFor(() => {
      expect(screen.getByText("brief.md")).toBeInTheDocument();
      expect(screen.queryByText("还没有活动记录")).not.toBeInTheDocument();
    });
  });

  it("uses the remembered files location for the back button target", async () => {
    window.sessionStorage.setItem(
      "activity-return-to",
      "/files?folder=folder-123",
    );

    renderActivity();

    expect(await screen.findByText("Audit Center")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toHaveAttribute(
      "data-back-to-path",
      "",
    );
  });

  it("keeps the audit center stack on fluid clamp-based arbitrary rem sizing", () => {
    const auditedFiles = [
      resolve(__dirname, "Activity.tsx"),
      resolve(__dirname, "../components/common/NeuSelect.tsx"),
      resolve(__dirname, "../components/common/NeuDatePicker.tsx"),
    ];

    const offenders = auditedFiles.flatMap((filePath) =>
      listFixedRemArbitraryUtilities(readFileSync(filePath, "utf8")).map(
        (token) => `${basename(filePath)}:${token}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
