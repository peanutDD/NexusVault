import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  FileText,
  Folder,
  Hourglass,
  KeyRound,
  ListChecks,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import PageLayout from "../components/layout/PageLayout";
import {
  settingsInputClass,
  settingsPanelClass,
} from "../components/settings/settingsUi";
import { NeuDatePicker } from "../components/common/NeuDatePicker";
import {
  NeuSelect,
  type NeuSelectOption,
} from "../components/common/NeuSelect";
import { activityService, type ActivityEvent } from "../services/activity";
import { useAuthStore } from "../store/authStore";
import { resolveActivityReturnTarget } from "../utils/activityReturnTarget";
import { cn } from "../utils/cn";

const SOURCE_OPTIONS = [
  ["", "全部来源"],
  ["web", "Files"],
  ["share", "Shares"],
  ["file_request", "Requests"],
  ["webdav", "WebDAV"],
  ["worker", "Worker"],
] as const;

const SOURCE_LABELS = new Map<string, string>([
  ["web", "Files"],
  ["files", "Files"],
  ["share", "Shares"],
  ["shares", "Shares"],
  ["file_request", "Requests"],
  ["file_requests", "Requests"],
  ["webdav", "WebDAV"],
  ["worker", "Worker"],
]);

const filterLabelClass =
  "grid min-w-0 gap-[clamp(0.3rem,0.7vw,0.38rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]";

const filterInputClass = settingsInputClass(
  false,
  "min-h-[clamp(2.5rem,5.8vw,2.75rem)] text-[length:var(--settings-text-sm)] font-semibold",
);

const raisedSurfaceClass =
  "settings-neu-raised-card activityRaisedSurface rounded-[clamp(1rem,2.4vw,1.25rem)] border border-[var(--settings-surface-border)] [background:var(--settings-surface-bg)] shadow-[var(--settings-surface-shadow)]";

const insetSurfaceClass =
  "settings-neu-inset-panel activityInsetSurface rounded-[clamp(1rem,2.4vw,1.25rem)] border border-transparent [background:var(--neu-inset-bg)] shadow-[var(--neu-inset-shadow)]";

const chipClass =
  "settings-neu-inset-control activityFlatChip inline-flex items-center gap-[clamp(0.32rem,0.85vw,0.4rem)] rounded-full border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] px-[clamp(0.58rem,1.6vw,0.72rem)] py-[clamp(0.24rem,0.7vw,0.32rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)]";

const eventMetaChipClass =
  "settings-neu-inset-control activityFlatChip inline-flex items-center gap-[clamp(0.3rem,0.7vw,0.38rem)] rounded-full border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] px-[clamp(0.5rem,1.3vw,0.62rem)] py-[clamp(0.2rem,0.6vw,0.28rem)] text-[length:var(--settings-text-xs)] font-semibold";

const insetButtonClass =
  "settings-neu-inset-control activityFlatButton rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] text-[var(--settings-secondary-text)] transition-[border-color,background,filter,opacity] duration-200 hover:border-[var(--settings-panel-border-hover)] hover:[filter:brightness(1.04)] active:[filter:brightness(0.98)] focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] disabled:cursor-not-allowed disabled:opacity-50";

const timelineListViewportClass = "min-h-0 overflow-visible";

const loadMoreDotClass =
  "block h-[clamp(0.52rem,1.45vw,0.68rem)] w-[clamp(0.52rem,1.45vw,0.68rem)] rounded-full bg-white shadow-[var(--activity-neu-raised-shadow)]";

const timelineActionButtonSizeClass =
  "activityTimelineFluidAction inline-flex min-w-0 items-center justify-center rounded-full px-[clamp(0.88rem,2.2vw,1.04rem)] py-[clamp(0.46rem,1.2vw,0.58rem)]";

const timelineRefreshButtonClass =
  "activityFlatButton activityFlatRefreshButton border border-transparent bg-[#10B981] text-[length:var(--settings-text-sm)] font-bold text-white transition-[filter,opacity] duration-200 hover:[filter:brightness(1.04)] active:[filter:brightness(0.94)] focus:outline-none focus:ring-2 focus:ring-[rgba(16,185,129,0.42)] disabled:cursor-not-allowed disabled:opacity-70";

const heroTitleClass =
  "text-[length:var(--settings-text-xl)] font-semibold tracking-[0.01em] text-[var(--settings-panel-value)]";

const heroDescriptionClass =
  "mt-[clamp(0.38rem,1vw,0.5rem)] max-w-[clamp(20rem,58vw,38rem)] text-[length:var(--settings-text-sm)] leading-[clamp(1.35rem,2.9vw,1.5rem)] text-[var(--settings-subtitle)]";

const panelTitleClass =
  "text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]";

const timelineHeadingClass =
  "text-[length:var(--settings-text-xs)] font-semibold uppercase tracking-[0.18em] text-[var(--settings-chip-text)]";

const identityBadgeBaseClass =
  "activitySemanticBadge inline-flex items-center gap-[clamp(0.28rem,0.7vw,0.34rem)] rounded-full px-[clamp(0.54rem,1.3vw,0.66rem)] py-[clamp(0.24rem,0.6vw,0.3rem)] text-[length:clamp(0.66rem,1.2vw,0.72rem)] font-semibold uppercase tracking-[0.12em]";

const sourceSelectOptions: readonly NeuSelectOption[] = SOURCE_OPTIONS.map(
  ([value, label]) => ({ value, label }),
);

function sourceLabel(source: string) {
  return SOURCE_LABELS.get(source) ?? source;
}

function metadataTitle(event: ActivityEvent) {
  const filename = event.metadata?.filename;
  const originalFilename = event.metadata?.original_filename;
  if (typeof filename === "string" && filename.trim() !== "") return filename;
  if (typeof originalFilename === "string" && originalFilename.trim() !== "") {
    return originalFilename;
  }
  return event.file_id ?? event.share_id ?? event.file_request_id ?? event.target_type;
}

function eventIdentityLine(event: ActivityEvent) {
  const segments: Array<{ key: string; value: string }> = [];
  if (event.file_id) segments.push({ key: "file", value: event.file_id });
  if (event.folder_id) {
    segments.push({ key: "folder", value: event.folder_id });
  }
  if (event.share_id) segments.push({ key: "share", value: event.share_id });
  if (event.file_request_id) {
    segments.push({ key: "request", value: event.file_request_id });
  }
  if (event.api_token_id) segments.push({ key: "token", value: event.api_token_id });
  if (segments.length === 0) {
    segments.push({ key: event.target_type, value: event.target_type });
  }
  return segments;
}

function statusLabel(status: number | null) {
  return status === null ? "recorded" : String(status);
}

function identityBadgeToneClass(key: string) {
  switch (key) {
    case "file":
      return "activitySemanticBadge--success";
    case "folder":
      return "activitySemanticBadge--warning";
    case "request":
      return "activitySemanticBadge--danger";
    case "share":
      return "activitySemanticBadge--info";
    case "token":
      return "activitySemanticBadge--neutral";
    default:
      return "activitySemanticBadge--neutral";
  }
}

function identityBadgeIcon(key: string) {
  switch (key) {
    case "file":
      return FileText;
    case "folder":
      return Folder;
    case "request":
      return Send;
    case "share":
      return Send;
    case "token":
      return KeyRound;
    default:
      return Hourglass;
  }
}

function statusBadgeToneClass(status: number | null) {
  if (status === null) return "activitySemanticBadge--neutral";
  if (status >= 200 && status < 300) return "activitySemanticBadge--success";
  if (status >= 300 && status < 500) return "activitySemanticBadge--warning";
  return "activitySemanticBadge--danger";
}

function statusBadgeIcon(status: number | null) {
  if (status === null) return Hourglass;
  if (status >= 200 && status < 300) return CheckCircle2;
  if (status >= 300 && status < 500) return Hourglass;
  return X;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceBadgeToneClass(source: string) {
  switch (source) {
    case "web":
    case "files":
      return "border-[rgba(88,142,255,0.24)] text-[var(--settings-action-text)]";
    case "share":
    case "shares":
      return "border-[rgba(148,163,184,0.18)] text-[var(--settings-chip-text)]";
    case "file_request":
    case "file_requests":
      return "border-[rgba(148,163,184,0.14)] text-[var(--settings-panel-value)]";
    case "webdav":
      return "border-[rgba(88,142,255,0.18)] text-[var(--settings-action-text)]";
    case "worker":
      return "border-[rgba(34,197,94,0.2)] text-[var(--settings-action-text)]";
    default:
      return "border-[rgba(148,163,184,0.14)] text-[var(--settings-panel-label)]";
  }
}

export default function Activity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [source, setSource] = useState("");
  const [eventType, setEventType] = useState("");
  const [targetType, setTargetType] = useState("");
  const [fileId, setFileId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [shareId, setShareId] = useState("");
  const [fileRequestId, setFileRequestId] = useState("");
  const [apiTokenId, setApiTokenId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const filters = useMemo(
    () => ({
      limit: 10,
      source,
      event_type: eventType,
      target_type: targetType,
      file_id: fileId,
      folder_id: folderId,
      share_id: shareId,
      file_request_id: fileRequestId,
      api_token_id: apiTokenId,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    [
      apiTokenId,
      dateFrom,
      dateTo,
      eventType,
      fileId,
      fileRequestId,
      folderId,
      shareId,
      source,
      targetType,
    ],
  );

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["activity", filters],
    queryFn: () => activityService.list(filters),
  });

  useEffect(() => {
    if (!data) return;
    setEvents(data.events);
    setNextCursor(data.next_cursor);
  }, [data]);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const handleBack = useCallback(() => {
    navigate(resolveActivityReturnTarget(), { replace: true });
  }, [navigate]);

  const activeFilterCount = useMemo(
    () =>
      [
        source,
        eventType,
        targetType,
        fileId,
        folderId,
        shareId,
        fileRequestId,
        apiTokenId,
        dateFrom,
        dateTo,
      ].filter((value) => value !== "")
        .length,
    [
      apiTokenId,
      dateFrom,
      dateTo,
      eventType,
      fileId,
      fileRequestId,
      folderId,
      shareId,
      source,
      targetType,
    ],
  );

  const activeFilterBadges = useMemo(() => {
    const badges: Array<{ label: string; testId: string }> = [];
    if (source) {
      badges.push({
        label: sourceLabel(source),
        testId: "activity-active-filter-source",
      });
    }
    if (eventType) {
      badges.push({ label: eventType, testId: "activity-active-filter-event-type" });
    }
    if (targetType) {
      badges.push({
        label: targetType,
        testId: "activity-active-filter-target-type",
      });
    }
    if (fileId) {
      badges.push({ label: fileId, testId: "activity-active-filter-file-id" });
    }
    if (folderId) {
      badges.push({ label: folderId, testId: "activity-active-filter-folder-id" });
    }
    if (shareId) {
      badges.push({ label: shareId, testId: "activity-active-filter-share-id" });
    }
    if (fileRequestId) {
      badges.push({
        label: fileRequestId,
        testId: "activity-active-filter-file-request-id",
      });
    }
    if (apiTokenId) {
      badges.push({
        label: apiTokenId,
        testId: "activity-active-filter-api-token-id",
      });
    }
    if (dateFrom) {
      badges.push({ label: `自 ${dateFrom}`, testId: "activity-active-filter-date-from" });
    }
    if (dateTo) {
      badges.push({ label: `至 ${dateTo}`, testId: "activity-active-filter-date-to" });
    }
    return badges;
  }, [
    apiTokenId,
    dateFrom,
    dateTo,
    eventType,
    fileId,
    fileRequestId,
    folderId,
    shareId,
    source,
    targetType,
  ]);

  const isSyncing = isFetching && !isLoading;

  const resetFilters = () => {
    setSource("");
    setEventType("");
    setTargetType("");
    setFileId("");
    setFolderId("");
    setShareId("");
    setFileRequestId("");
    setApiTokenId("");
    setDateFrom("");
    setDateTo("");
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await activityService.list({
        ...filters,
        cursor: nextCursor,
      });
      const seen = new Set(events.map((event) => event.id));
      const mergedEvents = [
        ...events,
        ...response.events.filter((event) => !seen.has(event.id)),
      ];
      const mergedResponse = {
        events: mergedEvents,
        next_cursor: response.next_cursor,
      };
      setEvents(mergedEvents);
      setNextCursor(response.next_cursor);
      queryClient.setQueryData(["activity", filters], mergedResponse);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <PageLayout
      title="Audit Center"
      username={user?.username}
      onLogout={handleLogout}
      useSolidBackground
    >
      <section className="mx-auto w-full">
          <div
            data-testid="activity-center-frame"
            className={settingsPanelClass(
              "mx-auto w-full max-w-[clamp(20rem,94vw,80rem)] overflow-hidden rounded-[clamp(1.25rem,3vw,1.5rem)] p-[clamp(0.78rem,1.8vw,1rem)]",
            )}
          >
          <div
            data-testid="activity-hero-shell"
            className={cn(
              raisedSurfaceClass,
              "mb-[clamp(1rem,2.25vw,1.25rem)] p-[clamp(1rem,2.25vw,1.35rem)]",
            )}
          >
            <div className="flex flex-col gap-[clamp(0.92rem,2.2vw,1rem)] lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 lg:max-w-[clamp(24rem,56vw,42rem)]">
                <button
                  type="button"
                  onClick={handleBack}
                  data-testid="activity-page-back-button"
                  className={cn(
                    "activityCodepenGhostButton",
                    insetButtonClass,
                    "mb-[clamp(0.74rem,1.9vw,0.9rem)] inline-flex items-center gap-[clamp(0.38rem,1vw,0.5rem)] px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.3rem,0.9vw,0.42rem)] text-[length:var(--settings-text-xs)]",
                  )}
                >
                  <ArrowLeft className="h-[clamp(0.8rem,2vw,0.94rem)] w-[clamp(0.8rem,2vw,0.94rem)] shrink-0" aria-hidden="true" />
                  返回上一级
                </button>
                <h2 data-testid="activity-hero-title" className={heroTitleClass}>
                  Audit Center
                </h2>
                <p className={heroDescriptionClass}>
                  用
                  <span className="font-semibold text-[var(--settings-panel-value)]">
                    统一的时间线
                  </span>
                  查看文件、分享和检索动作，不改任何调试链路，只把界面收束成完整的
                  <span className="font-semibold text-[var(--settings-chip-text)]">
                    Neuromorphic 控制台
                  </span>
                  。
                </p>
                <div className="mt-[clamp(0.74rem,1.9vw,0.9rem)] flex flex-wrap items-center gap-[clamp(0.48rem,1.35vw,0.62rem)]">
                  <span
                    data-testid="activity-status-pill"
                    className={cn(
                      chipClass,
                      "px-[clamp(0.7rem,1.85vw,0.86rem)] py-[clamp(0.28rem,0.8vw,0.38rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-action-text)]",
                    )}
                  >
                    Live timeline
                  </span>
                  <span className={chipClass}>{events.length} events</span>
                  <span className={chipClass}>{activeFilterCount} filters</span>
                </div>
              </div>

              <div className="grid gap-[clamp(0.64rem,1.75vw,0.8rem)] lg:min-w-[clamp(15rem,28vw,19rem)]">
                <div className={cn(insetSurfaceClass, "grid gap-[clamp(0.3rem,0.7vw,0.38rem)] p-[clamp(0.74rem,1.9vw,0.9rem)]")}>
                  <span className="text-[length:var(--settings-text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--settings-action-text)]">
                    Personal scope
                  </span>
                  <span className="text-[length:var(--settings-text-md)] font-semibold text-[var(--settings-panel-value)]">
                    {user?.username ?? "Current user"}
                  </span>
                  <span className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                    只展示当前登录用户的活动轨迹
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            data-testid="activity-center-workspace"
            className="grid gap-[clamp(0.9rem,2vw,1.25rem)] lg:grid-cols-[minmax(clamp(15rem,28vw,18rem),0.36fr)_minmax(0,1fr)]"
          >
            <aside
              data-testid="activity-filter-panel"
              className={settingsPanelClass(
                "activityFlatPanel h-fit rounded-[clamp(1rem,2.4vw,1.25rem)] p-[clamp(0.95rem,2vw,1.1rem)]",
              )}
            >
              <div className={cn(raisedSurfaceClass, "mb-[clamp(0.8rem,1.95vw,0.95rem)] p-[clamp(0.74rem,1.9vw,0.9rem)]")}>
                <div className="flex items-center gap-[clamp(0.38rem,1vw,0.5rem)] text-[var(--settings-action-text)]">
                  <ListChecks className="h-[clamp(0.88rem,2.2vw,1rem)] w-[clamp(0.88rem,2.2vw,1rem)] shrink-0" />
                  <span
                    data-testid="activity-filter-title"
                    className={panelTitleClass}
                  >
                    筛选轨道
                  </span>
                </div>
                <p className="mt-[clamp(0.34rem,0.9vw,0.46rem)] text-[length:var(--settings-text-xs)] leading-[clamp(1.18rem,2.6vw,1.34rem)] text-[var(--settings-subtitle)]">
                  来源、动作、文件 ID 和时间范围会直接重刷个人审计流。
                </p>
                <div className="mt-[clamp(0.64rem,1.75vw,0.8rem)] flex flex-wrap gap-[clamp(0.38rem,1vw,0.5rem)]">
                  <span className={chipClass}>Source</span>
                  <span className={chipClass}>Type</span>
                  <span className={chipClass}>Range</span>
                </div>
              </div>
              <div
                data-testid="activity-filter-fields-shell"
                className={cn(
                  "settings-neu-inset-panel activityInsetSurface activityFilterFieldsShell grid gap-[clamp(0.74rem,1.9vw,0.9rem)] rounded-[clamp(0.92rem,2.2vw,1rem)] border border-transparent [background:var(--neu-inset-bg)] p-[clamp(0.74rem,1.9vw,0.9rem)] shadow-[var(--neu-inset-shadow)]",
                )}
              >
                <label className={filterLabelClass}>
                  来源
                  <NeuSelect
                    ariaLabel="来源"
                    onChange={setSource}
                    options={sourceSelectOptions}
                    testIdPrefix="activity-source"
                    value={source}
                  />
                </label>
                <label className={filterLabelClass}>
                  动作
                  <input
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    placeholder="file.uploaded"
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  目标类型
                  <input
                    value={targetType}
                    onChange={(event) => setTargetType(event.target.value)}
                    placeholder="file"
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  文件 ID
                  <input
                    value={fileId}
                    onChange={(event) => setFileId(event.target.value)}
                    placeholder="file-..."
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  文件夹 ID
                  <input
                    value={folderId}
                    onChange={(event) => setFolderId(event.target.value)}
                    placeholder="folder-..."
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  分享 ID
                  <input
                    value={shareId}
                    onChange={(event) => setShareId(event.target.value)}
                    placeholder="share-..."
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  请求 ID
                  <input
                    value={fileRequestId}
                    onChange={(event) => setFileRequestId(event.target.value)}
                    placeholder="request-..."
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  Token ID
                  <input
                    value={apiTokenId}
                    onChange={(event) => setApiTokenId(event.target.value)}
                    placeholder="token-..."
                    className={filterInputClass}
                  />
                </label>
                <label className={filterLabelClass}>
                  开始日期
                  <NeuDatePicker
                    ariaLabel="开始日期"
                    onChange={setDateFrom}
                    testIdPrefix="activity-date-from"
                    value={dateFrom}
                  />
                </label>
                <label className={filterLabelClass}>
                  结束日期
                  <NeuDatePicker
                    ariaLabel="结束日期"
                    onChange={setDateTo}
                    testIdPrefix="activity-date-to"
                    value={dateTo}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className={cn(
                  insetButtonClass,
                  "mt-[clamp(0.92rem,2.2vw,1rem)] inline-flex w-full items-center justify-center px-[clamp(0.9rem,2.2vw,1.08rem)] py-[clamp(0.56rem,1.4vw,0.68rem)]",
                )}
              >
                清除筛选
              </button>
            </aside>

              <div
                data-testid="activity-timeline-panel"
                className={settingsPanelClass(
                  "activityFlatPanel relative overflow-visible rounded-[clamp(1rem,2.4vw,1.25rem)] p-[clamp(0.9rem,1.9vw,1.08rem)]",
                )}
              >
              <div className={cn(raisedSurfaceClass, "mb-[clamp(0.8rem,1.95vw,0.95rem)] p-[clamp(0.8rem,1.95vw,0.96rem)]")}>
                <div className="flex flex-col gap-[clamp(0.52rem,1.4vw,0.68rem)] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p
                      data-testid="activity-timeline-heading"
                      className={timelineHeadingClass}
                    >
                      Activity timeline
                    </p>
                    <p className="mt-[clamp(0.18rem,0.52vw,0.26rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                      按时间倒序显示最新动作，保留现有鉴权、筛选和分页逻辑。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-[clamp(0.38rem,1vw,0.5rem)]">
                    <span className={chipClass}>{events.length} visible</span>
                    {nextCursor && <span className={chipClass}>More available</span>}
                    {isSyncing && <span className={chipClass}>正在更新时间线...</span>}
                  </div>
                </div>
                {activeFilterBadges.length > 0 && (
                  <div className="mt-[clamp(0.62rem,1.6vw,0.76rem)] flex flex-wrap gap-[clamp(0.38rem,1vw,0.5rem)]">
                    {activeFilterBadges.map((badge) => (
                      <span
                        key={badge.testId}
                        data-testid={badge.testId}
                        className={chipClass}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isLoading && (
                <div
                  className={cn(
                    insetSurfaceClass,
                    "flex min-h-[clamp(13rem,40dvh,18rem)] items-center justify-center p-[clamp(1rem,2vw,1.25rem)] text-center",
                  )}
                >
                  <p className="text-[var(--settings-panel-label)]">加载活动中...</p>
                </div>
              )}
              {isSyncing && (
                <div className="mb-[clamp(0.74rem,1.9vw,0.9rem)]">
                  <div
                    className={cn(
                      insetSurfaceClass,
                      "flex items-center justify-between gap-[clamp(0.62rem,1.6vw,0.76rem)] p-[clamp(0.7rem,1.85vw,0.86rem)]",
                    )}
                  >
                    <p className="text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-panel-label)]">
                      正在更新时间线...
                    </p>
                    <RotateCcw className="h-[clamp(0.84rem,2vw,1rem)] w-[clamp(0.84rem,2vw,1rem)] animate-spin text-[var(--settings-panel-label)]" />
                  </div>
                </div>
              )}
              {isError && (
                <div
                  className={cn(
                    insetSurfaceClass,
                    "flex min-h-[clamp(13rem,40dvh,18rem)] items-center justify-center p-[clamp(1rem,2vw,1.25rem)] text-center",
                  )}
                >
                  <p className="font-semibold text-[var(--color-danger-text)]">
                    活动记录加载失败
                  </p>
                </div>
              )}
              {!isLoading && !isError && events.length === 0 && (
                <div
                  data-testid="activity-empty-state"
                  className={cn(
                    insetSurfaceClass,
                    "flex min-h-[clamp(13rem,40dvh,18rem)] flex-col items-center justify-center gap-[clamp(0.64rem,1.75vw,0.8rem)] p-[clamp(1rem,2vw,1.25rem)] text-center text-[var(--settings-panel-label)]",
                  )}
                >
                  <FileSearch className="h-[clamp(1.6rem,4vw,2rem)] w-[clamp(1.6rem,4vw,2rem)]" />
                  <p className="font-semibold text-[var(--settings-panel-value)]">
                    还没有活动记录
                  </p>
                  <p className="max-w-[clamp(18rem,52vw,22rem)] text-[length:var(--settings-text-xs)] leading-[clamp(1.18rem,2.6vw,1.34rem)] text-[var(--settings-subtitle)]">
                    当前用户还没有产生符合筛选条件的审计事件，先执行一次上传、分享或检索动作就能看到时间线。
                  </p>
                </div>
              )}
              {!isLoading && !isError && events.length > 0 && (
                <div
                  data-testid="activity-timeline-list-viewport"
                  className={timelineListViewportClass}
                >
                  <ol className="grid gap-[clamp(0.62rem,1.55vw,0.78rem)]">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        data-testid={`activity-event-card-${event.id}`}
                        className={cn(
                          insetSurfaceClass,
                          "grid min-w-0 grid-rows-[auto_auto_auto] gap-[clamp(0.52rem,1.25vw,0.64rem)] overflow-hidden p-[clamp(0.78rem,1.65vw,0.92rem)]",
                        )}
                      >
                        <div
                          data-testid={`activity-event-header-${event.id}`}
                          className="grid min-w-0 gap-[clamp(0.38rem,1vw,0.5rem)] sm:grid-cols-[minmax(0,1fr)_max-content] sm:items-center"
                        >
                          <div className="flex min-w-0 items-center gap-[clamp(0.38rem,1vw,0.5rem)] overflow-hidden">
                            <span
                              data-testid={`activity-event-source-${event.id}`}
                              className={cn(
                                eventMetaChipClass,
                                "shrink-0",
                                sourceBadgeToneClass(event.source),
                              )}
                            >
                              {sourceLabel(event.source)}
                            </span>
                            <p
                              data-testid={`activity-event-type-${event.id}`}
                              className="min-w-0 flex-1 truncate text-[length:var(--settings-text-sm)] font-semibold leading-[clamp(1.35rem,2.9vw,1.5rem)] text-[var(--settings-panel-value)]"
                            >
                              {event.event_type}
                            </p>
                          </div>
                          <span
                            data-testid={`activity-event-status-${event.id}`}
                            className={cn(
                              identityBadgeBaseClass,
                              "w-fit shrink-0",
                              statusBadgeToneClass(event.status),
                            )}
                          >
                            {(() => {
                              const StatusIcon = statusBadgeIcon(event.status);
                              return (
                                <StatusIcon className="h-[clamp(0.72rem,1.6vw,0.82rem)] w-[clamp(0.72rem,1.6vw,0.82rem)]" />
                              );
                            })()}
                            {statusLabel(event.status)}
                          </span>
                        </div>
                        <div
                          data-testid={`activity-event-body-${event.id}`}
                          className="min-w-0 grid gap-[clamp(0.22rem,0.55vw,0.3rem)]"
                        >
                          <p
                            data-testid={`activity-event-title-${event.id}`}
                            className="break-all text-[length:var(--settings-text-sm)] font-semibold leading-[clamp(1.35rem,2.9vw,1.5rem)] text-[var(--settings-title)]"
                          >
                            {metadataTitle(event)}
                          </p>
                          <p className="text-[length:var(--settings-text-xs)] font-semibold uppercase tracking-[0.14em] text-[var(--settings-subtitle)]">
                            {event.target_type}
                          </p>
                        </div>
                        <div
                          data-testid={`activity-event-footer-${event.id}`}
                          className="flex flex-col gap-[clamp(0.42rem,1vw,0.52rem)] border-t border-[var(--settings-panel-border)] pt-[clamp(0.5rem,1.15vw,0.62rem)] lg:grid lg:grid-cols-[minmax(0,1fr)_max-content] lg:items-end lg:gap-x-[clamp(0.66rem,1.65vw,0.8rem)]"
                        >
                          <div
                            data-testid={`activity-event-identity-panel-${event.id}`}
                            className="activityIdentityPanel grid min-w-0 content-start gap-[clamp(0.32rem,0.8vw,0.42rem)] rounded-[clamp(0.8rem,1.9vw,0.94rem)] px-[clamp(0.62rem,1.45vw,0.76rem)] py-[clamp(0.48rem,1.1vw,0.58rem)]"
                          >
                            <div
                            data-testid={`activity-event-identity-${event.id}`}
                            className="grid min-w-0 content-start justify-items-start gap-[clamp(0.22rem,0.55vw,0.3rem)] text-[var(--settings-subtitle)]"
                          >
                            {eventIdentityLine(event).map((identity) => (
                              <div
                                key={identity.key}
                                data-testid={`activity-event-identity-${identity.key}-${event.id}`}
                                className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-[clamp(0.46rem,1.1vw,0.56rem)]"
                              >
                                {(() => {
                                  const IdentityIcon = identityBadgeIcon(identity.key);
                                  return (
                                    <span
                                      className={cn(
                                        identityBadgeBaseClass,
                                        identityBadgeToneClass(identity.key),
                                      )}
                                    >
                                      <IdentityIcon className="h-[clamp(0.72rem,1.6vw,0.82rem)] w-[clamp(0.72rem,1.6vw,0.82rem)]" />
                                      {identity.key}
                                    </span>
                                  );
                                })()}
                                <span className="min-w-0 break-all text-left font-mono text-[length:var(--settings-text-xs)] leading-[clamp(1rem,2vw,1.1rem)] text-[var(--settings-panel-value)]">
                                  {identity.value}
                                </span>
                              </div>
                            ))}
                            </div>
                          </div>
                          <time
                            data-testid={`activity-event-time-${event.id}`}
                            className="settings-neu-inset-control activityFlatChip inline-flex w-fit self-start items-center gap-[clamp(0.3rem,0.7vw,0.38rem)] whitespace-nowrap rounded-full border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] px-[clamp(0.58rem,1.6vw,0.72rem)] py-[clamp(0.28rem,0.8vw,0.38rem)] text-[length:var(--settings-text-xs)] font-semibold text-[var(--settings-chip-text)] lg:self-center"
                          >
                            <CalendarDays className="h-[clamp(0.88rem,2.2vw,1rem)] w-[clamp(0.88rem,2.2vw,1rem)]" />
                            {formatTime(event.created_at)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div
                data-testid="activity-timeline-actions"
                className="flex flex-wrap items-stretch justify-center gap-[clamp(0.7rem,1.8vw,0.9rem)] px-[clamp(0.16rem,0.55vw,0.24rem)] pt-[clamp(0.8rem,1.95vw,0.96rem)]"
              >
                <button
                  type="button"
                  data-testid="activity-refresh-button"
                  aria-busy={isFetching}
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className={cn(
                    timelineActionButtonSizeClass,
                    timelineRefreshButtonClass,
                    "rounded-[clamp(1.2rem,3vw,1.45rem)]",
                  )}
                >
                  {isFetching ? "刷新中..." : "刷新"}
                </button>
                {nextCursor && (
                  <button
                    type="button"
                    aria-busy={loadingMore}
                    aria-label="加载更多"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className={cn(
                      insetButtonClass,
                      timelineActionButtonSizeClass,
                      "disabled:opacity-60",
                    )}
                  >
                    <span
                      data-testid="activity-load-more-dots"
                      aria-hidden="true"
                      className="flex items-center gap-[clamp(0.32rem,0.85vw,0.42rem)]"
                    >
                      {[1, 2, 3].map((dot) => (
                        <span
                          key={dot}
                          data-testid={`activity-load-more-dot-${dot}`}
                          className={cn(loadMoreDotClass, loadingMore && "animate-pulse")}
                        />
                      ))}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
