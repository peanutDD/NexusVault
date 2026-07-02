import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileActivityDialog from "./FileActivityDialog";
import { activityService } from "../../../services/activity";
import type { FileMetadata } from "../../../types/files";
import type { ActivityEvent } from "../../../services/activity";

vi.mock("../../common/dialog/Modal", () => ({
  default: ({
    title,
    description,
    children,
    placement,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
    placement?: string;
  }) => (
    <section role="dialog" aria-label={title} data-placement={placement}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </section>
  ),
}));

vi.mock("../../../services/activity", () => ({
  activityService: {
    listFile: vi.fn(),
  },
}));

const file: FileMetadata = {
  id: "file-1",
  filename: "brief.md",
  original_filename: "brief.md",
  file_size: 128,
  mime_type: "text/markdown",
  category: null,
  folder_id: null,
  created_at: "2026-05-01T00:00:00.000Z",
  deleted_at: null,
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 1000 * 60 * 5 } },
  });
}

function renderDialog(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <FileActivityDialog file={file} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

const baseActivityEvent: ActivityEvent = {
  id: "event-1",
  user_id: "user-1",
  actor_type: "user",
  actor_user_id: "user-1",
  source: "files",
  event_type: "file.downloaded",
  target_type: "file",
  file_id: "file-1",
  folder_id: null,
  share_id: null,
  file_request_id: null,
  api_token_id: null,
  status: 200,
  ip_address: null,
  user_agent: null,
  metadata: { filename: "brief.md" },
  created_at: "2026-05-24T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(activityService.listFile).mockResolvedValue({
    events: [baseActivityEvent],
    next_cursor: null,
  });
});

describe("FileActivityDialog", () => {
  it("loads and renders activity for the selected file only", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog", { name: "活动记录" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-placement", "nav-safe-center");
    expect(activityService.listFile).toHaveBeenCalledWith("file-1", { limit: 30 });
    expect(await screen.findByText("file.downloaded")).toBeInTheDocument();
    expect(screen.getAllByText("brief.md")).not.toHaveLength(0);
  });

  it("renders activity entries as inset rows for the timeline list", async () => {
    const { container } = renderDialog();

    await screen.findByRole("dialog", { name: "活动记录" });

    const list = await screen.findByTestId("file-activity-list");

    expect(list).toHaveClass(
      "px-[clamp(0.585rem,1.35vw,0.75rem)]",
      "py-[clamp(0.585rem,1.35vw,0.75rem)]",
      "overflow-y-auto",
      "overflow-x-hidden",
    );
    expect(within(list).getByText("brief.md")).toHaveClass(
      "[overflow-wrap:anywhere]",
    );
    expect(container.querySelector(".fileActionDialogInsetRow")).not.toBeNull();
    expect(container.querySelector(".fileActionDialogRaisedRow")).toBeNull();
  });

  it("gives activity row titles their own emphasized visual treatment", async () => {
    renderDialog();

    const list = await screen.findByTestId("file-activity-list");
    const title = await screen.findByText("file.downloaded");
    expect(title).toHaveClass("fileActionDialogEventTitle");
    expect(title).not.toHaveClass("text-[var(--dialog-panel-text)]");
    expect(within(list).getByText("brief.md")).toHaveClass(
      "fileActionDialogEventFilename",
    );
    expect(within(list).getByText(/5月24日/)).toHaveClass(
      "fileActionDialogEventTime",
    );
  });

  it("maps file activity title hierarchy hooks to dedicated CSS selectors", () => {
    const css = readFileSync("src/styles/confirm-dialog.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain(".fileActionDialogEventTitle");
    expect(css).toContain(".fileActionDialogEventTitle::before");
    expect(css).toContain(".fileActionDialogEventFilename");
    expect(css).toContain(".fileActionDialogEventTime");
  });

  it("drives file activity rows from shared inset primitives", () => {
    const css = readFileSync("src/styles/confirm-dialog.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain(".fileActionDialogInsetRow");
    expect(css).toContain("background: var(--neu-inset-bg) !important");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow) !important");
    expect(css).not.toContain("--file-activity-row-glow-start");
    expect(css).not.toContain("--file-activity-title-bg");
    expect(css).not.toMatch(/linear-gradient|radial-gradient/);
  });

  it("matches the clean CodePen badge rhythm without alert gradients", () => {
    const css = readFileSync("src/styles/confirm-dialog.css", "utf8").replace(
      /\s+/g,
      " ",
    );

    expect(css).toContain('content: "\\2713";');
    expect(css).toContain("background: var(--neu-inset-bg);");
    expect(css).toContain("box-shadow: var(--neu-inset-shadow);");
    expect(css).not.toContain("--file-activity-alert-bg");
    expect(css).not.toContain("--file-activity-primary-start-rgb");
  });

  it("renders cached activity data when the dialog opens before refetch completes", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["file-activity", "file-1"], {
      events: [
        {
          ...baseActivityEvent,
          id: "cached-event-1",
          event_type: "file.previewed",
        },
      ],
      next_cursor: null,
    });
    vi.mocked(activityService.listFile).mockImplementation(
      () => new Promise(() => {}),
    );

    renderDialog(queryClient);

    expect(await screen.findByText("file.previewed")).toBeInTheDocument();
    expect(screen.queryByText("暂无活动记录。")).not.toBeInTheDocument();
  });

  it("refetches fresh cached empty activity when the dialog opens again", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["file-activity", "file-1"], {
      events: [],
      next_cursor: null,
    });
    vi.mocked(activityService.listFile).mockResolvedValue({
      events: [
        {
          ...baseActivityEvent,
          id: "preview-event-1",
          event_type: "file.previewed",
        },
      ],
      next_cursor: null,
    });

    renderDialog(queryClient);

    expect(await screen.findByText("file.previewed")).toBeInTheDocument();
    expect(screen.queryByText("暂无活动记录。")).not.toBeInTheDocument();
    expect(activityService.listFile).toHaveBeenCalledWith("file-1", { limit: 30 });
  });

  it("keeps an empty cached timeline in loading state while the reopen refetch is pending", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["file-activity", "file-1"], {
      events: [],
      next_cursor: null,
    });
    vi.mocked(activityService.listFile).mockImplementation(
      () => new Promise(() => {}),
    );

    renderDialog(queryClient);

    expect(await screen.findByText("加载中...")).toBeInTheDocument();
    expect(screen.queryByText("暂无活动记录。")).not.toBeInTheDocument();
  });
});
