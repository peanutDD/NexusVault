//! # Skeleton Component
//!
//! 骨架屏组件，用于加载状态的占位显示。

import { cn } from '../../utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * 骨架屏组件
 *
 * 用于在内容加载时显示占位符，提升用户体验。
 *
 * @example
 * ```tsx
 * <Skeleton variant="text" width="100%" height="20px" />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton variant="rectangular" width="100%" height={200} />
 * ```
 */
export default function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-700/50 dark:bg-gray-600/50';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-[shimmer_2s_infinite]',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * 文件列表项骨架屏（表格行）
 */
function FileRowSkeleton() {
  return (
    <tr className="border-b border-gray-700/50">
      <td className="px-3 py-2"><Skeleton variant="circular" width={18} height={18} /></td>
      <td className="px-2 py-2"><Skeleton variant="rectangular" width={56} height={56} className="rounded" /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width="70%" height={16} /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width={48} height={14} /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width={64} height={14} /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width={40} height={14} /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width={72} height={14} /></td>
      <td className="px-3 py-2"><Skeleton variant="text" width={120} height={14} /></td>
    </tr>
  );
}

/**
 * 文件列表骨架屏（多行）
 */
export function FileListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="min-w-[960px] overflow-hidden rounded-lg bg-gray-800 dark:bg-gray-900">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-700/80 dark:bg-gray-800/80">
            <th className="w-12 px-3 py-3" /><th className="w-[72px] px-2 py-3" />
            <th className="min-w-[180px] px-3 py-3" /><th className="w-20 px-3 py-3" />
            <th className="w-28 px-3 py-3" /><th className="w-24 px-3 py-3" />
            <th className="w-28 px-3 py-3" /><th className="w-48 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <FileRowSkeleton key={i} />
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
    <div className="rounded-xl bg-gray-800/80 p-3">
      {/* 缩略图占位 */}
      <Skeleton variant="rectangular" className="mb-3 aspect-square w-full rounded-lg" />
      {/* 文件名 */}
      <Skeleton variant="text" width="80%" height={16} className="mb-2" />
      {/* 文件大小和类型 */}
      <Skeleton variant="text" width="60%" height={12} className="mb-1" />
      {/* 上传时间 */}
      <Skeleton variant="text" width="40%" height={12} className="mb-3" />
      {/* 操作按钮区域 */}
      <div className="flex items-center justify-between border-t border-gray-700/50 pt-3">
        <div className="flex gap-1">
          <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
          <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
        </div>
        <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
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
        <FileCardSkeletonItem key={i} />
      ))}
    </>
  );
}
