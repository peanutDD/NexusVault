import { memo } from "react";
import { cn } from "../../utils/cn";

interface FileTypeIconProps {
  mimeType: string;
  className?: string;
}

/**
 * 根据 MIME 类型显示对应的文件图标
 * 支持 PDF、图片、视频、音频、文档、压缩包等类型
 */
const FileTypeIcon = memo(function FileTypeIcon({
  mimeType,
  className,
}: FileTypeIconProps) {
  const getIconByMimeType = () => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon data-oid="i6.xs.-" />;
    }
    if (mimeType.startsWith("video/")) {
      return <VideoIcon data-oid=".wyt45m" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <AudioIcon data-oid="n8de9nu" />;
    }
    if (mimeType === "application/pdf") {
      return <PdfIcon data-oid="dq2h7y_" />;
    }
    if (
      mimeType.includes("word") ||
      mimeType.includes("document") ||
      mimeType === "application/rtf"
    ) {
      return <DocIcon data-oid="2fewy7:" />;
    }
    if (
      mimeType.includes("excel") ||
      mimeType.includes("spreadsheet") ||
      mimeType === "text/csv"
    ) {
      return <SpreadsheetIcon data-oid=".4thv_a" />;
    }
    if (
      mimeType.includes("zip") ||
      mimeType.includes("rar") ||
      mimeType.includes("archive")
    ) {
      return <ArchiveIcon data-oid="j_893vv" />;
    }
    if (mimeType.startsWith("text/")) {
      return <TextIcon data-oid="1wjbumn" />;
    }
    return <DefaultFileIcon data-oid="p49o4qc" />;
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-[var(--filetype-icon-wrapper-bg)] h-[clamp(2rem,6vw,2.5rem)] w-[clamp(2rem,6vw,2.5rem)] rounded-[clamp(0.15rem,0.5vw,0.35rem)]",
        className,
      )}
      data-oid="clh3ndk"
    >
      {getIconByMimeType()}
    </div>
  );
});

// PDF 图标
function PdfIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-pdf)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="e3rquqi"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"
        data-oid="1w.2lln"
      />

      <path
        d="M8 12h2v2H8v-2zm0 3h6v1H8v-1zm0 2h6v1H8v-1z"
        data-oid="2.bk:9b"
      />
    </svg>
  );
}

// 图片图标
function ImageIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-image)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="m5jpsw0"
    >
      <path
        d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM5 5h14v9.59l-2.29-2.3a1 1 0 0 0-1.42 0L11 16.59l-2.29-2.3a1 1 0 0 0-1.42 0L5 16.59V5zm0 14v-1.59l3-3 2.29 2.3a1 1 0 0 0 1.42 0L16 12.41l3 3V19H5z"
        data-oid="e87ulzy"
      />

      <circle cx="8.5" cy="8.5" r="1.5" data-oid="snk2p0." />
    </svg>
  );
}

// 视频图标
function VideoIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-video)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="4gstg89"
    >
      <path
        d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4h-4zM4 18V9h16v9H4z"
        data-oid="obtd1wl"
      />

      <path d="M10 11l5 3-5 3v-6z" data-oid="ljv:69r" />
    </svg>
  );
}

// 音频图标
function AudioIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-audio)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="3:ptz2d"
    >
      <path
        d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6zM8 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
        data-oid="iidm:qy"
      />
    </svg>
  );
}

// 文档图标
function DocIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-doc)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="9fpmk60"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"
        data-oid="el3.qaz"
      />

      <path
        d="M8 12h8v1H8v-1zm0 2h8v1H8v-1zm0 2h5v1H8v-1z"
        data-oid="g5t3930"
      />
    </svg>
  );
}

// 表格图标
function SpreadsheetIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-sheet)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="_1kazpw"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"
        data-oid="8cku2wa"
      />

      <path
        d="M8 12h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zm-6 3h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z"
        data-oid="0dv90al"
      />
    </svg>
  );
}

// 压缩包图标
function ArchiveIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-archive)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="osyqyg-"
    >
      <path
        d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-6 2h2v2h-2V8zm0 3h2v2h-2v-2zm0 3h2v3h-2v-3z"
        data-oid="afxw5gn"
      />
    </svg>
  );
}

// 文本图标
function TextIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-text)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="72o60ns"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"
        data-oid="dvezzmi"
      />

      <path
        d="M8 12h8v1H8v-1zm0 2h8v1H8v-1zm0 2h8v1H8v-1z"
        data-oid="vun3jvj"
      />
    </svg>
  );
}

// 默认文件图标
function DefaultFileIcon() {
  return (
    <svg
      className="h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)] text-[var(--filetype-icon-default)]"
      viewBox="0 0 24 24"
      fill="currentColor"
      data-oid="xv.0q-5"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"
        data-oid=":jvjhs4"
      />
    </svg>
  );
}

export default FileTypeIcon;
