import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSearch, ListChecks } from "lucide-react";
import Modal from "../../common/dialog/Modal";
import { activityService, type ActivityEvent } from "../../../services/activity";
import type { FileMetadata } from "../../../types/files";

interface FileActivityDialogProps {
  file: FileMetadata;
  onClose: () => void;
}

const EMPTY_ACTIVITY_EVENTS: ActivityEvent[] = [];

function metadataTitle(event: ActivityEvent) {
  const filename = event.metadata?.filename;
  if (typeof filename === "string" && filename.trim() !== "") return filename;
  return event.file_id ?? event.event_type;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FileActivityDialog({
  file,
  onClose,
}: FileActivityDialogProps) {
  const [loadedEvents, setLoadedEvents] = useState<ActivityEvent[]>([]);
  const [loadedNextCursor, setLoadedNextCursor] = useState<string | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const activity = useQuery({
    queryKey: ["file-activity", file.id],
    queryFn: () => activityService.listFile(file.id, { limit: 30 }),
    refetchOnMount: "always",
  });
  const baseEvents = activity.data?.events ?? EMPTY_ACTIVITY_EVENTS;
  const events = useMemo(() => {
    if (!hasLoadedMore) return baseEvents;
    const seen = new Set(baseEvents.map((event) => event.id));
    return [
      ...baseEvents,
      ...loadedEvents.filter((event) => !seen.has(event.id)),
    ];
  }, [baseEvents, hasLoadedMore, loadedEvents]);
  const nextCursor = hasLoadedMore
    ? loadedNextCursor
    : (activity.data?.next_cursor ?? null);
  const isInitialActivityLoading =
    activity.isLoading ||
    (activity.isFetching && events.length === 0 && !hasLoadedMore);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await activityService.listFile(file.id, {
        limit: 30,
        cursor: nextCursor,
      });
      setLoadedEvents((current) => {
        const seen = new Set([
          ...baseEvents.map((event) => event.id),
          ...current.map((event) => event.id),
        ]);
        return [
          ...current,
          ...response.events.filter((event) => !seen.has(event.id)),
        ];
      });
      setLoadedNextCursor(response.next_cursor);
      setHasLoadedMore(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Modal
      title="活动记录"
      description={file.original_filename}
      onClose={onClose}
      maxWidth="lg"
      variant="glass"
      panelClassName="fileActionDialogShell"
      placement="nav-safe-center"
    >
      <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]">
        <div className="flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-panel-text)]">
          <ListChecks className="h-[clamp(0.9rem,1.8vw,1rem)] w-[clamp(0.9rem,1.8vw,1rem)]" />
          <span className="text-[clamp(0.78rem,1.6vw,0.9rem)] font-semibold">
            文件时间线
          </span>
        </div>

        {isInitialActivityLoading && (
          <p className="text-[var(--dialog-panel-text)]">加载中...</p>
        )}
        {!isInitialActivityLoading && activity.isError && (
          <p className="text-[var(--dialog-panel-text)]">活动记录加载失败</p>
        )}
        {!isInitialActivityLoading && !activity.isError && events.length === 0 && (
          <div className="fileActionDialogEmptyState fileActionDialogInsetList flex min-h-[clamp(8.5rem,18vw,10rem)] flex-col items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] rounded-[clamp(0.55rem,1.25vw,0.7rem)] text-center text-[var(--dialog-panel-text)]">
            <FileSearch className="h-[clamp(1.25rem,2.7vw,1.5rem)] w-[clamp(1.25rem,2.7vw,1.5rem)]" />
            <p>暂无活动记录。</p>
          </div>
        )}
        {!isInitialActivityLoading && !activity.isError && events.length > 0 && (
          <div
            data-testid="file-activity-list"
            className="fileActionDialogInsetList max-h-[min(58vh,32rem)] overflow-y-auto overflow-x-hidden rounded-[clamp(0.55rem,1.25vw,0.7rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]"
          >
            {events.map((event) => (
              <div
                key={event.id}
                className="fileActionDialogInsetRow mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.6rem,1.35vw,0.75rem)] border border-[var(--dialog-panel-border,var(--dialog-field-border))] bg-[var(--dialog-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)] last:mb-0"
              >
                <div className="flex flex-col gap-[clamp(0.28rem,0.75vw,0.35rem)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="fileActionDialogEventTitle max-w-full truncate rounded-[clamp(0.42rem,1vw,0.55rem)] px-[clamp(0.48rem,1.1vw,0.62rem)] py-[clamp(0.2rem,0.55vw,0.28rem)] text-[clamp(0.86rem,1.85vw,1.02rem)] font-bold tracking-[-0.02em]">
                      {event.event_type}
                    </p>
                    <p className="fileActionDialogEventFilename mt-[clamp(0.32rem,0.8vw,0.42rem)] break-words text-[clamp(0.72rem,1.6vw,0.84rem)] [overflow-wrap:anywhere]">
                      {metadataTitle(event)}
                    </p>
                  </div>
                  <time className="fileActionDialogEventTime inline-flex shrink-0 items-center gap-[clamp(0.28rem,0.75vw,0.35rem)] text-[clamp(0.7rem,1.55vw,0.8rem)]">
                    <CalendarDays className="h-[clamp(0.82rem,1.7vw,0.9rem)] w-[clamp(0.82rem,1.7vw,0.9rem)]" />
                    {formatTime(event.created_at)}
                  </time>
                </div>
              </div>
            ))}
            {nextCursor && (
              <div className="flex justify-center py-[clamp(0.39rem,0.9vw,0.5rem)]">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)] disabled:opacity-60"
                >
                  {loadingMore ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
