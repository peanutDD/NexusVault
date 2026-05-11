//! # Skeleton Component
//!
//! 骨架屏组件，用于加载状态的占位显示。

import type { CSSProperties } from "react";
import { cn } from "../../../utils/cn";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

/**
 * 骨架屏组件
 *
 * 用于在内容加载时显示占位符，提升用户体验。
 *
 * @example
 * ```tsx
 * <Skeleton variant="text" width="100%" height="1.25rem" />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton variant="rectangular" width="100%" height={200} />
 * ```
 */
export default function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseClasses = "bg-[var(--skeleton-bg)]";

  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-[clamp(0.4rem,1vw,0.5rem)]",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-[shimmer_2s_infinite]",
    none: "",
  };

  const toCssSize = (value?: string | number) =>
    typeof value === "number" ? `${value / 16}rem` : value;
  const style: CSSProperties = {
    width: toCssSize(width),
    height: toCssSize(height),
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className,
      )}
      style={style}
      aria-hidden="true"
      data-oid="b:vgq1i"
    />
  );
}

/**
 * 文件列表项骨架屏（表格行）
 */
function FileRowSkeleton() {
  return (
    <tr className="border-b border-[var(--skeleton-border)]" data-oid="x8l3ect">
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="ywhuc:c">
        <Skeleton
          variant="circular"
          width={18}
          height={18}
          data-oid="1i2t86r"
        />
      </td>
      <td className="px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="ciefws-">
        <Skeleton
          variant="rectangular"
          width={56}
          height={56}
          className="rounded"
          data-oid="4k:mwl2"
        />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid=".hxzkt.">
        <Skeleton variant="text" width="70%" height={16} data-oid="1wh3via" />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="cso39lv">
        <Skeleton variant="text" width={48} height={14} data-oid="cov8.tb" />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="1j8_6gz">
        <Skeleton variant="text" width={64} height={14} data-oid="_xw0328" />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="zrdoru8">
        <Skeleton variant="text" width={40} height={14} data-oid="ky-f-y4" />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="ljq2vbn">
        <Skeleton variant="text" width={72} height={14} data-oid="mgegnuo" />
      </td>
      <td className="px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid=":j7l7j-">
        <Skeleton variant="text" width={120} height={14} data-oid="s.lx-j5" />
      </td>
    </tr>
  );
}

/**
 * 文件列表骨架屏（多行）
 */
export function FileListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      className="min-w-[60rem] overflow-hidden rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--skeleton-surface-bg-strong)]"
      data-oid="rzzj7yc"
    >
      <table className="w-full table-fixed border-collapse" data-oid="by7hc9y">
        <thead data-oid="b__upe0">
          <tr
            className="border-b border-[var(--skeleton-border)] bg-[var(--skeleton-header-bg)]"
            data-oid="4yuyl-a"
          >
            <th className="w-[clamp(2.75rem,5.4vw,3rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="xklb.0q" />
            <th className="w-[4.5rem] px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="itq1s5-" />
            <th className="min-w-[11.25rem] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="vi91p5d" />
            <th className="w-[clamp(4.75rem,9vw,5rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="._zf406" />
            <th className="w-[clamp(6.75rem,12.6vw,7rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="5wyw3nr" />
            <th className="w-[clamp(5.75rem,10.8vw,6rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="5kdefrh" />
            <th className="w-[clamp(6.75rem,12.6vw,7rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid="584ox3u" />
            <th className="w-[clamp(11.75rem,21.6vw,12rem)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.585rem,1.35vw,0.75rem)]" data-oid=".chb85." />
          </tr>
        </thead>
        <tbody data-oid="1y6_mwc">
          {Array.from({ length: count }).map((_, i) => (
            <FileRowSkeleton key={i} data-oid="q8wko89" />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 文件卡片骨架屏（单个）
 */
function FileCardSkeletonItem() {
  return (
    <div
      className="rounded-[clamp(0.3rem,0.8vw,0.375rem)] bg-[var(--skeleton-surface-bg)] p-[clamp(0.585rem,1.35vw,0.75rem)]"
      data-oid="3yxzj:g"
    >
      {/* 缩略图占位 */}
      <Skeleton
        variant="rectangular"
        className="mb-[clamp(0.585rem,1.35vw,0.75rem)] aspect-square w-full rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
        data-oid="w0wgzbr"
      />

      {/* 文件名 */}
      <Skeleton
        variant="text"
        width="80%"
        height={16}
        className="mb-[clamp(0.39rem,0.9vw,0.5rem)]"
        data-oid="-yclzsc"
      />

      {/* 文件大小和类型 */}
      <Skeleton
        variant="text"
        width="60%"
        height={12}
        className="mb-[clamp(0.195rem,0.45vw,0.25rem)]"
        data-oid="db44g.1"
      />

      {/* 上传时间 */}
      <Skeleton
        variant="text"
        width="40%"
        height={12}
        className="mb-[clamp(0.585rem,1.35vw,0.75rem)]"
        data-oid="uzt8yg9"
      />

      {/* 操作按钮区域 */}
      <div
        className="flex items-center justify-between border-t border-[var(--skeleton-border)] pt-[clamp(0.585rem,1.35vw,0.75rem)]"
        data-oid="6nfbo63"
      >
        <div className="flex gap-[clamp(0.195rem,0.45vw,0.25rem)]" data-oid="o1sttbk">
          <Skeleton
            variant="rectangular"
            width={32}
            height={32}
            className="rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
            data-oid="ym1lppd"
          />

          <Skeleton
            variant="rectangular"
            width={32}
            height={32}
            className="rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
            data-oid="3tod3dm"
          />
        </div>
        <Skeleton
          variant="rectangular"
          width={32}
          height={32}
          className="rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
          data-oid="rmblrsk"
        />
      </div>
    </div>
  );
}

/**
 * 文件卡片网格骨架屏
 */
export function FileCardSkeleton({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <FileCardSkeletonItem key={i} data-oid="yeq-whh" />
      ))}
    </>
  );
}
