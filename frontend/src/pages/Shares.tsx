import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Folder,
  Gauge,
  Home,
  Link2,
  ListChecks,
  LockKeyhole,
  UploadCloud,
  XCircle,
} from "lucide-react";
import PageLayout from "../components/layout/PageLayout";
import ErrorMessage from "../components/common/feedback/ErrorMessage";
import { useAuthStore } from "../store/authStore";
import { shareService, type ManagedShare, type ShareAccessEvent } from "../services/shares";
import {
  fileRequestService,
  type FileRequestLink,
  type FileRequestSubmission,
  type FileRequestUpload,
} from "../services/fileRequests";
import { folderService } from "../services/folders";
import type { Folder as FolderRecord } from "../types/folders";
import { getErrorMessage } from "../utils/error";
import { formatFileSize } from "../utils/format";
import { cn } from "../utils/cn";
import { useClipboard } from "../hooks/useClipboard";
import {
  settingsInputClass,
  settingsPanelClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
} from "../components/settings/settingsUi";

type Tab = "shares" | "requests";

type ReviewDraft = {
  filename: string;
  folder_id?: string | null;
  folder_name?: string | null;
  review_note: string;
};

function absoluteShareUrl(token: string) {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

function shareLimitText(share: ManagedShare) {
  if (share.max_downloads) {
    return `${share.download_count}/${share.max_downloads} downloads`;
  }
  if (share.expires_at) {
    return `expires ${new Date(share.expires_at).toLocaleDateString()}`;
  }
  return "open link";
}

const shareBadgeClass =
  "share-color-badge shareCenterFlatBadge inline-flex w-fit shrink-0 items-center gap-[clamp(0.24rem,0.55vw,0.32rem)] rounded-full border border-transparent px-[clamp(0.55rem,1.18vw,0.72rem)] py-[clamp(0.24rem,0.55vw,0.34rem)] text-[length:var(--settings-text-xs)] font-bold shadow-none";

const shareBadgeIconClass =
  "h-[clamp(0.62rem,1.45vw,0.8rem)] w-[clamp(0.62rem,1.45vw,0.8rem)] shrink-0";

const managementListBaseClass =
  "shareCenterCodepenList mx-auto flex w-full flex-col items-center gap-[clamp(0.58rem,1.35vw,0.75rem)] overflow-hidden p-[clamp(0.58rem,1.35vw,0.75rem)] [scrollbar-gutter:stable] sm:max-h-[min(62vh,42rem)] sm:overflow-auto";

const shareCenterSharesWorkspaceGridClass =
  "shareCenterSharesStack grid grid-cols-1 items-start gap-[clamp(0.78rem,1.8vw,1rem)]";

const shareCenterRequestStackClass =
  "shareCenterRequestStack grid grid-cols-1 items-stretch gap-[clamp(0.78rem,1.8vw,1rem)]";

const fileRequestActionButtonClass =
  "inline-flex w-full min-w-0 items-center justify-center gap-[clamp(0.39rem,0.9vw,0.5rem)] whitespace-nowrap px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-center";

const fileRequestCreateControlClass =
  "fileRequestCreateControl min-h-[clamp(2.75rem,6vw,3.15rem)]";

const fileRequestFluidActionClass =
  "w-full min-w-0 items-center justify-center whitespace-nowrap px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-center";

const fileRequestReviewActionGridClass =
  "grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,clamp(7.5rem,24vw,9rem)),1fr))] gap-[clamp(0.39rem,0.9vw,0.5rem)]";

const fileRequestUploadsPanelClass =
  "file-request-uploads-list space-y-[clamp(0.58rem,1.35vw,0.75rem)] overflow-visible";

const fileRequestDetailPanelClass =
  "fileRequestInboxDetailPanel shareCenterRequestDetailPanel shareCenterNeuRaisedPanel flex w-full min-w-0 flex-col rounded-[clamp(0.7rem,1.6vw,0.75rem)] border p-[clamp(0.78rem,1.8vw,1rem)] transition-[background,border-color] duration-150";

const fileRequestReviewActionPillBaseClass = cn(
  "fileRequestReviewActionPill",
  fileRequestFluidActionClass,
  "inline-flex rounded-full border border-transparent text-[length:var(--settings-text-sm)] font-bold leading-none tracking-normal",
  "transition-[background,color,filter] duration-150 hover:brightness-[1.04] active:brightness-[0.96]",
  "disabled:cursor-not-allowed",
);

const fileRequestInboxFlatButtonClass = cn(
  "fileRequestInboxFlatButton shareCenterNeuActionButton inline-flex min-w-0 items-center justify-center gap-[clamp(0.35rem,0.8vw,0.45rem)] whitespace-nowrap rounded-[clamp(0.7rem,1.6vw,0.75rem)] border",
  "px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-center text-[length:var(--settings-text-xs)] font-medium leading-none",
  "transition-[background,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-60",
);

const fileRequestInboxFlatInputClass = cn(
  "fileRequestInboxFlatInput shareCenterNeuControl shareCenterNeuFormInput w-full min-w-0 rounded-[clamp(0.7rem,1.6vw,0.75rem)] border",
  "px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.68rem,1.5vw,0.75rem)]",
  "text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]",
  "transition-[background,border-color] duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)]",
);

const fileRequestInboxFlatFieldClass = cn(
  "fileRequestInboxFlatField shareCenterNeuControl flex min-h-[clamp(2.2rem,5vw,2.75rem)] min-w-0 items-center rounded-[clamp(0.82rem,1.8vw,0.95rem)] border",
  "px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.52rem,1.2vw,0.68rem)] leading-snug break-words",
);

function fileRequestReviewActionPillToneClass(tone: "preview" | "open" | "approve" | "reject") {
  return `fileRequestReviewActionPill--${tone}`;
}

const shareCenterInlineActionGroupClass =
  "grid w-full grid-cols-1 gap-[clamp(0.39rem,0.9vw,0.5rem)] sm:grid-cols-2";

const shareManagedRowBaseClass =
  "share-managed-row shareCenterNeuRaisedSurface shareCenterNeuDataRow grid w-full min-w-0 gap-[clamp(0.58rem,1.35vw,0.82rem)] rounded-[clamp(0.78rem,1.8vw,0.95rem)] border border-transparent p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-kpi-shadow)] transition-[transform,box-shadow,border-color]";

const shareManagedActionsClass =
  "shareCenterActionTileGroup flex w-full flex-wrap items-center justify-end gap-[clamp(0.39rem,0.9vw,0.5rem)] self-end";

function shareCenterSecondaryActionClass(
  className?: string,
  tone: "purple" | "green" | "red" = "purple",
) {
  const toneClass =
    tone === "green"
      ? "shareCenterCodepenActionTile--success"
      : tone === "red"
        ? "shareCenterCodepenActionTile--danger"
        : "shareCenterCodepenActionTile--primary";

  return settingsSecondaryButtonClass(
    cn(
      "shareCenterFlatIconButton shadow-none hover:shadow-none",
      "shareCenterNeuActionButton shareCenterActionTile shareCenterCodepenActionTile",
      toneClass,
      className,
    ),
  );
}

function managementListScrollClass(itemCount: number) {
  return cn(
    managementListBaseClass,
    itemCount > 5
      ? "mobile-five-item-scroll max-h-[min(70vh,36rem)] overflow-auto"
      : "max-h-none overflow-visible",
  );
}

function shareBadgeToneClass(tone: "green" | "yellow" | "red") {
  if (tone === "red") return "[background:var(--share-badge-red-bg)] text-[var(--share-badge-red-text)]";
  if (tone === "yellow") return "[background:var(--share-badge-yellow-bg)] text-[var(--share-badge-yellow-text)]";
  return "[background:var(--share-badge-green-bg)] text-[var(--share-badge-green-text)]";
}

function shareStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["closed", "revoked", "expired", "inactive"].some((value) => normalized.includes(value))) {
    return "red";
  }
  if (["pending", "limited", "queued", "waiting"].some((value) => normalized.includes(value))) {
    return "yellow";
  }
  return "green";
}

function shareStatusIcon(status: string) {
  const tone = shareStatusTone(status);
  if (tone === "red") return XCircle;
  if (tone === "yellow") return Clock3;
  return CircleCheck;
}

function shareBadgeLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function folderLocationLabel(folderId?: string | null, folderName?: string | null) {
  if (!folderId) return "根目录";
  return folderName || "未命名文件夹";
}

function filesHrefForFolder(folderId?: string | null) {
  return folderId ? `/files?folder=${encodeURIComponent(folderId)}` : "/files";
}

function PublishFolderSelector({
  filename,
  defaultFolderId,
  defaultFolderName,
  selectedFolderId,
  selectedFolderName,
  disabled,
  onSelect,
}: {
  filename: string;
  defaultFolderId?: string | null;
  defaultFolderName?: string | null;
  selectedFolderId?: string | null;
  selectedFolderName?: string | null;
  disabled?: boolean;
  onSelect: (folderId: string | null, folderName: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [path, setPath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "根目录" }]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveFolderId = selectedFolderId === undefined ? defaultFolderId ?? null : selectedFolderId;
  const effectiveFolderName = selectedFolderId === undefined ? defaultFolderName ?? null : selectedFolderName ?? null;
  const currentLabel = folderLocationLabel(effectiveFolderId, effectiveFolderName);

  const loadFolders = useCallback(async (nextParentId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      setFolders(await folderService.list(nextParentId));
    } catch (err) {
      setError(getErrorMessage(err, "读取文件夹失败"));
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const openSelector = useCallback(() => {
    setOpen((next) => {
      if (!next) {
        void loadFolders(parentId);
      }
      return !next;
    });
  }, [loadFolders, parentId]);

  const enterFolder = useCallback((folder: FolderRecord) => {
    setParentId(folder.id);
    setPath((current) => [...current, { id: folder.id, name: folder.name }]);
    void loadFolders(folder.id);
  }, [loadFolders]);

  const jumpToPath = useCallback((index: number) => {
    const nextPath = path.slice(0, index + 1);
    const nextParentId = nextPath[nextPath.length - 1]?.id ?? null;
    setPath(nextPath);
    setParentId(nextParentId);
    void loadFolders(nextParentId);
  }, [loadFolders, path]);

  return (
    <div className="grid gap-[clamp(0.35rem,0.8vw,0.45rem)]">
      <button
        type="button"
        aria-label={`Choose publish folder for ${filename}`}
        disabled={disabled}
        onClick={openSelector}
        className={cn(fileRequestInboxFlatButtonClass, "w-full justify-between text-left")}
      >
        <span className="min-w-0 truncate">目标位置：{currentLabel}</span>
        <ChevronRight className="h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)] shrink-0" />
      </button>
      {open && (
        <div className="fileRequestInboxFlatPopover rounded-[clamp(0.7rem,1.6vw,0.75rem)] border p-[clamp(0.5rem,1.1vw,0.625rem)]">
          <div className="mb-[clamp(0.35rem,0.8vw,0.45rem)] flex flex-wrap items-center gap-[clamp(0.3rem,0.7vw,0.4rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
            {path.map((item, index) => (
              <button
                key={`${item.id ?? "root"}-${index}`}
                type="button"
                onClick={() => jumpToPath(index)}
                className="rounded-[clamp(0.4rem,0.9vw,0.5rem)] px-[clamp(0.35rem,0.8vw,0.45rem)] py-[clamp(0.2rem,0.45vw,0.25rem)] hover:[background:var(--settings-kpi-bg)]"
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="grid max-h-[clamp(8rem,22vw,12rem)] gap-[clamp(0.25rem,0.6vw,0.35rem)] overflow-auto">
            <button
              type="button"
              aria-label="Select root folder"
              onClick={() => {
                onSelect(null, null);
                setOpen(false);
              }}
              className={cn(fileRequestInboxFlatButtonClass, "justify-start px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)]")}
            >
              <Home className="h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)]" />
              根目录
              {!effectiveFolderId && <Check className="ml-auto h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)]" />}
            </button>
            {loading && <p className="px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">加载文件夹中...</p>}
            {error && <p className="px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-form-error)]">{error}</p>}
            {folders.map((folder) => (
              <div key={folder.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-[clamp(0.25rem,0.6vw,0.35rem)]">
                <button
                  type="button"
                  aria-label={`Select folder ${folder.name}`}
                  onClick={() => {
                    onSelect(folder.id, folder.name);
                    setOpen(false);
                  }}
                  className={cn(fileRequestInboxFlatButtonClass, "justify-start px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)]")}
                >
                  <Folder className="h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)]" />
                  <span className="min-w-0 truncate">{folder.name}</span>
                  {effectiveFolderId === folder.id && <Check className="ml-auto h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)]" />}
                </button>
                <button
                  type="button"
                  aria-label={`Open folder ${folder.name}`}
                  onClick={() => enterFolder(folder)}
                  className={cn(fileRequestInboxFlatButtonClass, "px-[clamp(0.45rem,1vw,0.55rem)] py-[clamp(0.3rem,0.8vw,0.4rem)]")}
                >
                  <ChevronRight className="h-[clamp(0.72rem,1.6vw,0.9rem)] w-[clamp(0.72rem,1.6vw,0.9rem)]" />
                </button>
              </div>
            ))}
            {!loading && !error && folders.length === 0 && (
              <p className="px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">当前层级没有子文件夹。</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shares() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [tab, setTab] = useState<Tab>("shares");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState("Upload files");
  const [oneTimeRequestUrl, setOneTimeRequestUrl] = useState<string | null>(null);
  const [activeShareEvents, setActiveShareEvents] = useState<{
    share: ManagedShare;
    events: ShareAccessEvent[];
  } | null>(null);
  const [activeUploads, setActiveUploads] = useState<{
    request: FileRequestLink;
    submissions: FileRequestSubmission[];
    nextCursor: string | null;
  } | null>(null);
  const [loadingMoreUploads, setLoadingMoreUploads] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const requestDetailRef = useRef<HTMLElement | null>(null);
  const { copy: copyToClipboard } = useClipboard();

  const shares = useQuery({
    queryKey: ["share-center"],
    queryFn: shareService.listManagedShares,
  });
  const fileRequests = useQuery({
    queryKey: ["file-requests"],
    queryFn: fileRequestService.list,
  });

  const copy = useCallback(
    async (value: string) => {
      const copied = await copyToClipboard(value);
      if (copied) {
        setMessage("链接已复制");
      } else {
        setError("复制失败，请手动复制链接");
      }
    },
    [copyToClipboard],
  );

  const revokeShare = useCallback(
    async (share: ManagedShare) => {
      try {
        await shareService.deleteShare(share.id);
        await queryClient.invalidateQueries({ queryKey: ["share-center"] });
      } catch (err) {
        setError(getErrorMessage(err, "撤销分享失败"));
      }
    },
    [queryClient],
  );

  const createRequest = useCallback(async () => {
    try {
      const created = await fileRequestService.create({
        title: requestTitle.trim() || "Upload files",
        max_file_size: 1024 * 1024 * 1024,
        expires_in_days: 30,
      });
      if (created.public_url) {
        setOneTimeRequestUrl(created.public_url);
        await copy(created.public_url);
      }
      await queryClient.invalidateQueries({ queryKey: ["file-requests"] });
    } catch (err) {
      setError(getErrorMessage(err, "创建上传请求失败"));
    }
  }, [copy, queryClient, requestTitle]);

  const showShareEvents = useCallback(async (share: ManagedShare) => {
    try {
      const events = await shareService.listShareEvents(share.id);
      setActiveShareEvents({ share, events });
    } catch (err) {
      setError(getErrorMessage(err, "读取分享活动失败"));
    }
  }, []);

  const showUploads = useCallback(async (request: FileRequestLink) => {
    try {
      const inbox = await fileRequestService.inbox({ request_id: request.id, limit: 50 });
      setActiveUploads({ request, submissions: inbox.submissions, nextCursor: inbox.next_cursor });
      requestDetailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(getErrorMessage(err, "读取上传记录失败"));
    }
  }, []);

  const loadMoreUploads = useCallback(async () => {
    if (!activeUploads?.nextCursor || loadingMoreUploads) return;
    setLoadingMoreUploads(true);
    try {
      const inbox = await fileRequestService.inbox({
        request_id: activeUploads.request.id,
        limit: 50,
        cursor: activeUploads.nextCursor,
      });
      setActiveUploads({
        request: activeUploads.request,
        submissions: [...activeUploads.submissions, ...inbox.submissions],
        nextCursor: inbox.next_cursor,
      });
    } catch (err) {
      setError(getErrorMessage(err, "继续读取上传记录失败"));
    } finally {
      setLoadingMoreUploads(false);
    }
  }, [activeUploads, loadingMoreUploads]);

  const updateReviewDraft = useCallback(
    (upload: FileRequestUpload, patch: Partial<ReviewDraft>) => {
      setReviewDrafts((current) => {
        const existing = current[upload.id] ?? {
          filename: upload.filename,
          folder_id: undefined,
          folder_name: undefined,
          review_note: "",
        };
        return {
          ...current,
          [upload.id]: {
            ...existing,
            ...patch,
          },
        };
      });
    },
    [],
  );

  const reviewUpload = useCallback(
    async (upload: FileRequestUpload, action: "approve" | "reject") => {
      const draft = reviewDrafts[upload.id] ?? {
        filename: upload.filename,
        folder_id: undefined,
        folder_name: undefined,
        review_note: "",
      };
      try {
        await fileRequestService.reviewUpload(upload.id, {
          action,
          filename: action === "approve" ? draft.filename.trim() || upload.filename : undefined,
          folder_id: action === "approve" ? draft.folder_id : undefined,
          review_note: draft.review_note.trim() || undefined,
        });
        setMessage(action === "approve" ? "上传文件已通过审核" : "上传文件已拒收");
        await queryClient.invalidateQueries({ queryKey: ["file-requests"] });
        if (activeUploads) {
          const inbox = await fileRequestService.inbox({
            request_id: activeUploads.request.id,
            limit: 50,
          });
          setActiveUploads({
            request: activeUploads.request,
            submissions: inbox.submissions,
            nextCursor: inbox.next_cursor,
          });
        }
      } catch (err) {
        setError(getErrorMessage(err, action === "approve" ? "审核通过失败" : "拒收失败"));
      }
    },
    [activeUploads, queryClient, reviewDrafts],
  );

  const copyRequestPublicUrl = useCallback(
    async (request: FileRequestLink) => {
      if (request.public_url) {
        await copy(request.public_url);
        return;
      }
      setMessage("完整上传链接只在创建时显示，请使用创建后出现的一次性链接。");
    },
    [copy],
  );

  const revokeRequest = useCallback(
    async (request: FileRequestLink) => {
      if (request.revoked_at) {
        setMessage("上传请求已经撤销");
        return;
      }
      try {
        await fileRequestService.update(request.id, { revoked: true });
        await queryClient.invalidateQueries({ queryKey: ["file-requests"] });
        setMessage("上传请求已撤销");
      } catch (err) {
        setError(getErrorMessage(err, "撤销上传请求失败"));
      }
    },
    [queryClient],
  );

  const rows = useMemo(() => shares.data ?? [], [shares.data]);
  const requests = useMemo(() => fileRequests.data ?? [], [fileRequests.data]);

  return (
    <PageLayout
      title="SHARES"
      username={user?.username}
      onLogout={() => {
        clearAuth();
        navigate("/login");
      }}
      showSettings={false}
    >
      <div
        data-testid="share-center-frame"
        className="settings-neu-inset-panel shareCenterCodepenFrame mx-auto w-full max-w-[var(--app-shell-max-width)] overflow-x-hidden rounded-[clamp(1.25rem,3vw,1.5rem)] border border-[var(--settings-panel-border)] [background:var(--settings-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)] text-[length:var(--settings-text-md)] shadow-[var(--settings-panel-shadow)]"
      >
        <div
          data-testid="share-center-shell"
          className="settings-neu-raised-card shareCenterCodepenShell mb-[clamp(1rem,2.25vw,1.25rem)] max-w-full overflow-hidden rounded-[clamp(1rem,2.4vw,1.25rem)] [background:var(--settings-surface-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-surface-shadow)]"
        >
          <div
            data-testid="share-center-heading-row"
            className="flex flex-col gap-[clamp(0.78rem,1.8vw,1rem)] md:flex-row md:items-start md:justify-between"
          >
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className={settingsSecondaryButtonClass("inline-flex items-center px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[length:var(--settings-text-xs)]")}
              >
                <ArrowLeft className="mr-[clamp(0.39rem,0.9vw,0.5rem)] h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                Settings
              </button>
              <div className="mt-[clamp(0.7rem,1.6vw,0.875rem)]">
                <h1 className="font-brand text-[length:var(--settings-text-xl)] tracking-widest text-[var(--settings-title)]">
                  Share Center
                </h1>
                <p className="mt-[clamp(0.3rem,0.8vw,0.4rem)] text-[length:var(--settings-text-sm)] text-[var(--settings-subtitle)]">
                  管理分享链接、访问记录和只上传不可浏览的 File Request。
                </p>
              </div>
            </div>
            <div
              data-testid="share-tab-switcher"
              className="shareCenterTabSwitcher shareCenterToggleTabs relative grid w-full shrink-0 grid-cols-2 items-center sm:w-auto md:mt-[clamp(2.35rem,4.5vw,3rem)]"
            >
              <span
                aria-hidden="true"
                data-testid="share-tab-active-pill"
                className={cn(
                  "shareCenterToggleActivePill",
                  tab === "shares"
                    ? "shareCenterToggleActivePill--shares"
                    : "shareCenterToggleActivePill--requests",
                )}
              />
              <button
                type="button"
                aria-pressed={tab === "shares"}
                onClick={() => setTab("shares")}
                className={cn(
                  "shareCenterToggleButton relative z-[1] min-w-0 truncate whitespace-nowrap rounded-full px-[clamp(0.88rem,2vw,1.16rem)] py-[clamp(0.5rem,1.15vw,0.66rem)] text-center text-[length:var(--settings-text-xs)]",
                  tab === "shares" && "shareCenterToggleButton--active",
                )}
              >
                Shares
              </button>
              <button
                type="button"
                aria-pressed={tab === "requests"}
                onClick={() => setTab("requests")}
                className={cn(
                  "shareCenterToggleButton relative z-[1] min-w-0 truncate whitespace-nowrap rounded-full px-[clamp(0.88rem,2vw,1.16rem)] py-[clamp(0.5rem,1.15vw,0.66rem)] text-center text-[length:var(--settings-text-xs)]",
                  tab === "requests" && "shareCenterToggleButton--active",
                )}
              >
                File Requests
              </button>
            </div>
          </div>
        </div>

        {(error || message) && (
          <div
            data-testid="share-alert-stack"
            className="mb-[clamp(1rem,2.25vw,1.25rem)] space-y-[clamp(0.78rem,1.8vw,1rem)]"
          >
            {error && <ErrorMessage type="error" message={error} onClose={() => setError(null)} />}
            {message && <ErrorMessage type="info" message={message} onClose={() => setMessage(null)} />}
          </div>
        )}

        {tab === "shares" ? (
          <div
            data-testid="share-workspace-grid"
            className={shareCenterSharesWorkspaceGridClass}
          >
            <section
              data-testid="share-list-panel"
              className="shareCenterNeuRaisedPanel rounded-[clamp(1rem,2.4vw,1.25rem)] [background:var(--settings-surface-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-surface-shadow)]"
            >
              <div className="mb-[clamp(0.58rem,1.35vw,0.75rem)] flex items-center justify-between gap-[clamp(0.58rem,1.35vw,0.75rem)]">
                <div>
                  <p className="font-semibold text-[var(--settings-title)]">Share links</p>
                  <p className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                    {rows.length} links
                  </p>
                </div>
                <span className="shareCenterFlatBadge rounded-full [background:var(--settings-panel-bg)] px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.2rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)] shadow-none">
                  links
                </span>
              </div>
              <div
                data-testid="share-list-scroll"
                className={settingsPanelClass(managementListScrollClass(rows.length))}
              >
                {rows.map((share) => {
                  const isActive = activeShareEvents?.share.id === share.id;
                  const StatusIcon = shareStatusIcon(share.status);
                  return (
                    <div
                      key={share.id}
                      data-testid={`share-row-${share.id}`}
                      className={cn(
                        shareManagedRowBaseClass,
                        isActive && "shareCenterNeuPressedSurface [background:var(--settings-panel-bg)] shadow-[var(--neu-inset-shadow)]",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-[clamp(0.39rem,0.9vw,0.5rem)]">
                          <p className="min-w-0 truncate font-semibold text-[var(--settings-title)]">
                            {share.filename}
                          </p>
                          <span
                            data-testid={`share-status-badge-${share.id}`}
                            className={cn(
                              shareBadgeClass,
                              shareBadgeToneClass(shareStatusTone(share.status)),
                            )}
                          >
                            <StatusIcon className={shareBadgeIconClass} />
                            {shareBadgeLabel(share.status)}
                          </span>
                        </div>
                        <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                          access {share.access_count} · downloads {share.download_count} · {shareLimitText(share)}
                        </p>
                        <div
                          data-testid={`share-kind-badges-${share.id}`}
                          className="mt-[clamp(0.45rem,1vw,0.56rem)] flex flex-wrap items-center gap-[clamp(0.3rem,0.75vw,0.45rem)] text-[length:var(--settings-text-xs)]"
                        >
                          <span
                            data-testid={`share-direct-badge-${share.id}`}
                            className={cn(shareBadgeClass, shareBadgeToneClass("green"))}
                          >
                            <Link2 className={shareBadgeIconClass} />
                            Direct Link
                          </span>
                          {share.has_password && (
                            <span className={cn(shareBadgeClass, shareBadgeToneClass("yellow"))}>
                              <LockKeyhole className={shareBadgeIconClass} />
                              Password
                            </span>
                          )}
                          {share.max_downloads && (
                            <span className={cn(shareBadgeClass, shareBadgeToneClass("yellow"))}>
                              <Gauge className={shareBadgeIconClass} />
                              Limited
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        data-testid={`share-card-actions-${share.id}`}
                        className={shareManagedActionsClass}
                      >
                        <button
                          type="button"
                          aria-label={`Copy link for ${share.filename}`}
                          className={shareCenterSecondaryActionClass(
                            "px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]",
                            "green",
                          )}
                          onClick={() => copy(share.url || absoluteShareUrl(share.share_token))}
                        >
                          <Copy className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Recent activity for ${share.filename}`}
                          className={shareCenterSecondaryActionClass("px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]")}
                          onClick={() => showShareEvents(share)}
                        >
                          <ListChecks className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                        </button>
                        <button className={shareCenterSecondaryActionClass("px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]", "red")} onClick={() => revokeShare(share)} aria-label={`Revoke ${share.filename}`}>
                          <XCircle className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!rows.length && <p className="p-[clamp(1rem,2.25vw,1.25rem)] text-[var(--settings-subtitle)]">还没有分享链接。</p>}
              </div>
            </section>
            <aside
              data-testid="share-detail-panel"
              className="shareCenterNeuRaisedPanel shareCenterShareDetailPanel min-h-[clamp(12rem,30vw,18rem)] rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] p-[clamp(0.78rem,1.8vw,1rem)] transition-[background,border-color] duration-150"
            >
              {activeShareEvents ? (
                <>
                  <div
                    data-testid="share-events-heading-row"
                    className="mb-[clamp(0.5rem,1.1vw,0.625rem)] flex flex-row items-center justify-between gap-[clamp(0.5rem,1.1vw,0.625rem)]"
                  >
                    <div data-testid="share-events-title-block" className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--settings-title)]">Recent activity</p>
                      <p className="truncate text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                        {activeShareEvents.share.filename}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close share activity"
                      className={settingsSecondaryButtonClass("shareCenterClosePillButton shareCenterNeuActionButton ml-auto shrink-0 self-center rounded-full px-[clamp(0.7em,1.8vw,1em)] py-[clamp(0.35em,0.9vw,0.5em)] text-[length:var(--settings-text-xs)]")}
                      onClick={() => setActiveShareEvents(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div
                    data-testid="share-events-panel"
                    className="share-events-list shareCenterNeuDataList shareCenterNeuInsetSurface max-h-[min(42vh,24rem)] overflow-auto rounded-[clamp(0.72rem,1.6vw,0.85rem)] border p-[clamp(0.58rem,1.35vw,0.75rem)]"
                  >
                    {activeShareEvents.events.map((event) => (
                      <div
                        key={event.id}
                        data-testid={`share-event-row-${event.id}`}
                        className="shareCenterNeuDataRow shareCenterNeuRaisedSurface grid gap-[clamp(0.25rem,0.7vw,0.375rem)] rounded-[clamp(0.62rem,1.4vw,0.75rem)] border border-transparent p-[clamp(0.48rem,1.1vw,0.62rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                      >
                        <span className="min-w-0 truncate">{event.event_type}</span>
                        <span>{event.status}</span>
                        <span className="min-w-0 break-words sm:truncate">{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                    {!activeShareEvents.events.length && (
                      <p className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                        No recent activity.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div
                  data-testid="share-empty-state"
                  className="shareCenterNeuInsetSurface flex min-h-[clamp(9rem,24vw,14rem)] flex-col items-center justify-center rounded-[clamp(0.7rem,1.6vw,0.75rem)] border border-[var(--settings-panel-border)] p-[clamp(0.78rem,1.8vw,1rem)] text-center text-[var(--settings-subtitle)]"
                >
                  <p className="font-semibold text-[var(--settings-title)]">No share selected</p>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div
            data-testid="file-request-workspace-grid"
            className={shareCenterRequestStackClass}
          >
            <section
              data-testid="file-request-list-panel"
              className="shareCenterNeuRaisedPanel rounded-[clamp(1rem,2.4vw,1.25rem)] [background:var(--settings-surface-bg)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--settings-surface-shadow)]"
            >
              <div
                data-testid="file-request-controls-grid"
                className="mb-[clamp(0.78rem,1.8vw,1rem)] grid gap-[clamp(0.585rem,1.35vw,0.75rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,0.24fr)] md:items-stretch"
              >
                <div
                  data-testid="file-request-list-heading-row"
                  className="min-w-0 md:col-span-2"
                >
                  <p className="font-semibold text-[var(--settings-title)]">File Requests</p>
                  <p className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                    {requests.length} request{requests.length === 1 ? "" : "s"} · upload-only inbox links
                  </p>
                </div>
                <input
                  data-testid="file-request-title-input"
                  value={requestTitle}
                  onChange={(event) => setRequestTitle(event.target.value)}
	                  className={settingsInputClass(
	                    false,
	                    `${fileRequestCreateControlClass} fileRequestCreateInput shareCenterNeuControl shareCenterNeuFormInput min-w-0 md:col-start-1 md:row-start-2`,
	                  )}
                  placeholder="Request title"
                />
                <button
                  type="button"
                  aria-label="Create File Request"
                  onClick={createRequest}
	                  className={settingsPrimaryButtonClass(
	                    `${fileRequestActionButtonClass} ${fileRequestCreateControlClass} fileRequestCreateButton shareCenterNeuActionButton shareCenterCreatePillButton md:col-start-2 md:row-start-2`,
	                  )}
                >
                  <UploadCloud className="h-[clamp(0.9rem,2vw,1rem)] w-[clamp(0.9rem,2vw,1rem)]" />
                  Create
                </button>
              </div>
              {oneTimeRequestUrl && (
                <div data-testid="file-request-secret-panel" className={settingsPanelClass("mb-[clamp(0.78rem,1.8vw,1rem)]")}>
                  <div className="flex flex-col gap-[clamp(0.58rem,1.35vw,0.75rem)] sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                        One-time public upload link
                      </p>
                      <p className="mt-[clamp(0.2rem,0.45vw,0.25rem)] break-all font-mono text-[length:var(--settings-text-xs)] text-[var(--settings-title)]">
                        {oneTimeRequestUrl}
                      </p>
                    </div>
                    <div className={shareCenterInlineActionGroupClass}>
                      <button
                        type="button"
                        aria-label="Copy public link"
                        className={settingsSecondaryButtonClass(`${fileRequestFluidActionClass} text-[length:var(--settings-text-xs)]`)}
                        onClick={() => copy(oneTimeRequestUrl)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        aria-label="Hide public link"
                        className={settingsSecondaryButtonClass(`${fileRequestFluidActionClass} text-[length:var(--settings-text-xs)]`)}
                        onClick={() => setOneTimeRequestUrl(null)}
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div
                data-testid="file-request-list-scroll"
                className={settingsPanelClass(managementListScrollClass(requests.length))}
              >
                {requests.map((request) => (
                  <div
                    key={request.id}
                    data-testid={`file-request-row-${request.id}`}
                    className={shareManagedRowBaseClass}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--settings-title)]">{request.title}</p>
                      <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                        {request.revoked_at ? "revoked" : "active"} · uploads {request.upload_count}
                        {request.max_file_size ? ` · ${formatFileSize(request.max_file_size)}` : ""}
                      </p>
                      {!request.public_url && (
                        <p className="mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                          Full public link is shown only when created.
                        </p>
                      )}
                    </div>
                    <div
                      data-testid={`file-request-actions-${request.id}`}
                      className={shareManagedActionsClass}
                    >
                      <button
                        type="button"
                        aria-label={`Copy public upload link for ${request.title}`}
                        className={shareCenterSecondaryActionClass(
                          "px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]",
                          "green",
                        )}
                        onClick={() => copyRequestPublicUrl(request)}
                      >
                        <Link2 className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Received uploads for ${request.title}`}
                        className={shareCenterSecondaryActionClass("px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]")}
                        onClick={() => showUploads(request)}
                      >
                        <ListChecks className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Revoke File Request ${request.title}`}
                        className={shareCenterSecondaryActionClass(
                          "px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]",
                          "red",
                        )}
                        onClick={() => revokeRequest(request)}
                      >
                        <XCircle className="h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]" />
                      </button>
                    </div>
                  </div>
                ))}
                {!requests.length && <p className="p-[clamp(1rem,2.25vw,1.25rem)] text-[var(--settings-subtitle)]">还没有上传请求链接。</p>}
              </div>
            </section>
            <aside
              data-testid="file-request-detail-panel"
              ref={requestDetailRef}
              className={fileRequestDetailPanelClass}
            >
              {activeUploads ? (
                <>
                  <div
                    data-testid="file-request-uploads-heading-row"
                    className="mb-[clamp(0.5rem,1.1vw,0.625rem)] flex flex-row items-center justify-between gap-[clamp(0.5rem,1.1vw,0.625rem)]"
                  >
                    <p
                      data-testid="file-request-uploads-title"
                      className="min-w-0 flex-1 truncate font-semibold text-[var(--settings-title)]"
                    >
                      Inbox · {activeUploads.request.title}
                    </p>
                    <button
                      type="button"
                      aria-label="Close received uploads"
                      className={cn(fileRequestInboxFlatButtonClass, "ml-auto shrink-0 self-center px-[clamp(0.5rem,1.1vw,0.625rem)] py-[clamp(0.3rem,0.8vw,0.4rem)]")}
                      onClick={() => setActiveUploads(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div
                    data-testid="file-request-uploads-panel"
                    className={fileRequestUploadsPanelClass}
                  >
                    {activeUploads.submissions.map((submission) => {
                      const submissionTargetId = submission.request_folder_id ?? activeUploads.request.folder_id;
                      const submissionTargetName = submission.request_folder_name ?? activeUploads.request.folder_name;
                      const submissionTargetLabel = folderLocationLabel(submissionTargetId, submissionTargetName);
                      const submittedAt = new Date(submission.created_at).toLocaleString();

                      return (
                        <section
                          key={submission.id}
                          data-testid={`file-request-submission-row-${submission.id}`}
                          className="fileRequestInboxSubmissionCard fileRequestInboxSubmissionCard--inspector shareCenterNeuRaisedSurface grid gap-[clamp(0.62rem,1.4vw,0.82rem)] rounded-[clamp(0.78rem,1.8vw,0.95rem)] border p-[clamp(0.68rem,1.55vw,0.92rem)]"
                        >
                          <div className="grid gap-[clamp(0.28rem,0.65vw,0.36rem)]">
                            <p className="fileRequestInboxEyebrow text-[clamp(0.5rem,0.98vw,0.62rem)] font-semibold uppercase tracking-[0.16em]">
                              Submission
                            </p>
                            <div className="flex flex-col gap-[clamp(0.35rem,0.8vw,0.45rem)] sm:flex-row sm:items-end sm:justify-between">
                              <p className="fileRequestInboxStrongText min-w-0 text-[length:var(--settings-text-md)] font-semibold leading-tight">
                                Received submission
                              </p>
                              <p className="fileRequestInboxMutedText text-[length:var(--settings-text-xs)] font-medium">
                                {submission.file_count} file{submission.file_count === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          <div
                            data-testid={`file-request-submission-summary-strip-${submission.id}`}
                            className="fileRequestInboxSummaryStrip shareCenterNeuInsetSurface grid gap-[clamp(0.5rem,1.15vw,0.68rem)] overflow-hidden rounded-[clamp(0.72rem,1.6vw,0.85rem)] border p-[clamp(0.58rem,1.35vw,0.75rem)] md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.92fr)]"
                          >
                            <div className="fileRequestInboxSummaryCell min-w-0">
                              <p className="fileRequestInboxEyebrow text-[clamp(0.48rem,0.94vw,0.6rem)] font-semibold uppercase tracking-[0.16em]">
                                Submitter
                              </p>
                              <p
                                data-testid={`file-request-submission-submitter-value-${submission.id}`}
                                className="shareSubmissionFlatText fileRequestInboxStrongText mt-[clamp(0.18rem,0.42vw,0.25rem)] break-words text-[length:var(--settings-text-xs)] font-semibold leading-[1.35]"
                              >
                                {submission.submitter_email || "Anonymous submitter"}
                              </p>
                            </div>
                            <div className="fileRequestInboxSummaryCell min-w-0">
                              <p className="fileRequestInboxEyebrow text-[clamp(0.48rem,0.94vw,0.6rem)] font-semibold uppercase tracking-[0.16em]">
                                Note
                              </p>
                              <p
                                data-testid={`file-request-submission-note-value-${submission.id}`}
                                className="shareSubmissionFlatText fileRequestInboxBodyText mt-[clamp(0.18rem,0.42vw,0.25rem)] break-words text-[length:var(--settings-text-xs)] font-medium leading-[1.45]"
                              >
                                {submission.submitter_note || "No note"}
                              </p>
                            </div>
                            <div
                              data-testid={`file-request-submission-summary-${submission.id}`}
                              className="fileRequestInboxSummaryCell min-w-0"
                            >
                              <p className="fileRequestInboxEyebrow text-[clamp(0.48rem,0.94vw,0.6rem)] font-semibold uppercase tracking-[0.16em]">
                                Submitted
                              </p>
                              <p
                                data-testid={`file-request-submission-summary-value-${submission.id}`}
                                className="shareSubmissionFlatText fileRequestInboxStrongText mt-[clamp(0.18rem,0.42vw,0.25rem)] text-[length:var(--settings-text-xs)] font-semibold leading-[1.35]"
                              >
                                {submittedAt}
                              </p>
                            </div>
                            <div
                              data-testid={`file-request-submission-target-${submission.id}`}
                              className="fileRequestInboxSummaryCell min-w-0"
                            >
                              <p className="fileRequestInboxEyebrow text-[clamp(0.48rem,0.94vw,0.6rem)] font-semibold uppercase tracking-[0.16em]">
                                Target
                              </p>
                              <p
                                data-testid={`file-request-submission-target-value-${submission.id}`}
                                className="shareSubmissionFlatText fileRequestInboxStrongText mt-[clamp(0.18rem,0.42vw,0.25rem)] break-words text-[length:var(--settings-text-xs)] font-semibold leading-[1.35]"
                              >
                                目标位置：{submissionTargetLabel}
                              </p>
                            </div>
                          </div>
                          <div
                            data-testid={`file-request-upload-list-${submission.id}`}
                            className="fileRequestInboxFileList grid gap-[clamp(0.58rem,1.35vw,0.75rem)]"
                          >
                            {submission.uploads.map((upload) => {
                            const draft = reviewDrafts[upload.id] ?? {
                              filename: upload.filename,
                              folder_id: undefined,
                              folder_name: undefined,
                              review_note: "",
                            };
                            const requestFolderId = submission.request_folder_id ?? activeUploads.request.folder_id;
                            const requestFolderName = submission.request_folder_name ?? activeUploads.request.folder_name;
                            const isPending = upload.status === "pending";
                            const isApproved = upload.status === "approved";
                            const UploadStatusIcon = shareStatusIcon(upload.status);
                              return (
                                <article
                                  key={upload.id}
                                  data-testid={`file-request-upload-row-${upload.id}`}
                                  className="fileRequestInboxUploadRow fileRequestInboxFileItem shareCenterNeuRaisedSurface grid gap-[clamp(0.55rem,1.2vw,0.7rem)] rounded-[clamp(0.72rem,1.6vw,0.85rem)] border p-[clamp(0.68rem,1.55vw,0.86rem)] text-[length:var(--settings-text-xs)]"
                                >
                                  <div
                                    data-testid={`file-request-upload-header-${upload.id}`}
                                    className="fileRequestInboxFileHeader flex flex-wrap items-center justify-end gap-[clamp(0.45rem,1vw,0.6rem)]"
                                  >
                                    <div
                                      data-testid={`file-request-upload-status-row-${upload.id}`}
                                      className="fileRequestInboxUploadStatusRow flex flex-wrap items-center justify-end gap-[clamp(0.35rem,0.8vw,0.45rem)]"
                                    >
                                      <span
                                        data-testid={`file-request-upload-status-${upload.id}`}
                                        className={cn(
                                          shareBadgeClass,
                                          shareBadgeToneClass(shareStatusTone(upload.status)),
                                        )}
                                      >
                                        <UploadStatusIcon className={shareBadgeIconClass} />
                                        {shareBadgeLabel(upload.status)}
                                      </span>
                                      <span
                                        className={cn(
                                          shareBadgeClass,
                                          shareBadgeToneClass(
                                            upload.scan_status === "clean" || upload.scan_status === "scanned" ? "green" : "yellow",
                                          ),
                                          "font-medium",
                                        )}
                                      >
                                        {shareBadgeLabel(upload.scan_status ?? "not_scanned")}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    data-testid={`file-request-upload-review-grid-${upload.id}`}
                                    className="fileRequestInboxReviewGrid grid gap-[clamp(0.5rem,1.1vw,0.62rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
                                  >
                                    <div
                                      data-testid={`file-request-upload-publish-${upload.id}`}
                                      className="fileRequestInboxPublishPanel shareCenterNeuInsetSurface grid gap-[clamp(0.42rem,0.95vw,0.55rem)] rounded-[clamp(0.62rem,1.4vw,0.75rem)] border p-[clamp(0.56rem,1.25vw,0.7rem)]"
                                    >
                                      <div className="grid gap-[clamp(0.28rem,0.65vw,0.38rem)]">
                                        <p className="fileRequestInboxEyebrow text-[clamp(0.5rem,0.98vw,0.62rem)] font-semibold uppercase tracking-[0.16em]">
                                          Review filename
                                        </p>
                                        <input
                                          aria-label={`Review filename for ${upload.filename}`}
                                          value={draft.filename}
                                          disabled={!isPending}
                                          onChange={(event) => updateReviewDraft(upload, { filename: event.target.value })}
                                          className={fileRequestInboxFlatInputClass}
                                        />
                                      </div>
                                      <div className="grid gap-[clamp(0.28rem,0.65vw,0.38rem)]">
                                        <p className="fileRequestInboxEyebrow text-[clamp(0.5rem,0.98vw,0.62rem)] font-semibold uppercase tracking-[0.16em]">
                                          Publish destination
                                        </p>
                                        {isPending ? (
                                          <PublishFolderSelector
                                            filename={upload.filename}
                                            defaultFolderId={requestFolderId}
                                            defaultFolderName={requestFolderName}
                                            selectedFolderId={draft.folder_id}
                                            selectedFolderName={draft.folder_name}
                                            onSelect={(folderId, folderName) => updateReviewDraft(upload, {
                                              folder_id: folderId,
                                              folder_name: folderName,
                                            })}
                                          />
                                        ) : isApproved ? (
                                          <p className={cn(fileRequestInboxFlatFieldClass, "text-[var(--settings-title)]")}>
                                            已发布到：{folderLocationLabel(upload.folder_id, upload.folder_name)}
                                          </p>
                                        ) : (
                                          <p className={cn(fileRequestInboxFlatFieldClass, "text-[var(--settings-subtitle)]")}>
                                            未发布：{shareBadgeLabel(upload.status)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      data-testid={`file-request-upload-review-${upload.id}`}
                                      className="fileRequestInboxReviewPanel shareCenterNeuInsetSurface grid content-start gap-[clamp(0.42rem,0.95vw,0.55rem)] rounded-[clamp(0.62rem,1.4vw,0.75rem)] border p-[clamp(0.56rem,1.25vw,0.7rem)]"
                                    >
                                      <p className="fileRequestInboxEyebrow text-[clamp(0.5rem,0.98vw,0.62rem)] font-semibold uppercase tracking-[0.16em]">
                                        Review note
                                      </p>
                                      <input
                                        aria-label={`Review note for ${upload.filename}`}
                                        value={draft.review_note}
                                        disabled={!isPending}
                                        onChange={(event) => updateReviewDraft(upload, { review_note: event.target.value })}
                                        className={fileRequestInboxFlatInputClass}
                                        placeholder="Review note"
                                      />
                                    </div>
                                  </div>
                                  <div
                                    data-testid={`file-request-upload-actions-${upload.id}`}
                                    className={fileRequestReviewActionGridClass}
                                  >
                                  <a
                                    href={isApproved
                                      ? fileRequestService.previewApprovedFileUrl(upload.file_id)
                                      : fileRequestService.previewUploadUrl(upload.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      fileRequestReviewActionPillBaseClass,
                                      fileRequestReviewActionPillToneClass("preview"),
                                    )}
                                  >
                                    Preview
                                  </a>
                                  {isApproved && (
                                    <a
                                      href={filesHrefForFolder(upload.folder_id)}
                                      aria-label={`Open in Files for ${upload.filename}`}
                                      className={cn(
                                        fileRequestReviewActionPillBaseClass,
                                        fileRequestReviewActionPillToneClass("open"),
                                      )}
                                    >
                                      Open in Files
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!isPending}
                                    onClick={() => reviewUpload(upload, "approve")}
                                    className={cn(
                                      fileRequestReviewActionPillBaseClass,
                                      fileRequestReviewActionPillToneClass("approve"),
                                    )}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!isPending}
                                    onClick={() => reviewUpload(upload, "reject")}
                                    className={cn(
                                      fileRequestReviewActionPillBaseClass,
                                      fileRequestReviewActionPillToneClass("reject"),
                                    )}
                                  >
                                    Reject
                                  </button>
                                  </div>
                                </article>
                            );
                          })}
                          </div>
                        </section>
                      );
                    })}
                    {!activeUploads.submissions.length && (
                      <p className="text-[length:var(--settings-text-xs)] text-[var(--settings-subtitle)]">
                        No pending submissions yet.
                      </p>
                    )}
                    {activeUploads.nextCursor && (
                      <button
                        type="button"
                        aria-label="Load more inbox submissions"
                        disabled={loadingMoreUploads}
                        onClick={loadMoreUploads}
                        className={cn(fileRequestInboxFlatButtonClass, "mt-[clamp(0.58rem,1.35vw,0.75rem)] w-full")}
                      >
                        {loadingMoreUploads ? "Loading..." : "Load more"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div
                  data-testid="file-request-empty-state"
                  className="fileRequestInboxEmptyPanel shareCenterNeuInsetSurface flex min-h-[clamp(9rem,24vw,14rem)] flex-col items-center justify-center rounded-[clamp(0.7rem,1.6vw,0.75rem)] border p-[clamp(0.78rem,1.8vw,1rem)] text-center text-[var(--settings-subtitle)]"
                >
                  <p className="font-semibold text-[var(--settings-title)]">No request selected</p>
                  <p className="mt-[clamp(0.2rem,0.45vw,0.25rem)] text-[length:var(--settings-text-xs)]">
                    Choose a File Request to inspect received uploads.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
