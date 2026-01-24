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
 * 文件列表项骨架屏
 */
export function FileRowSkeleton() {
  return (
    <div className="grid grid-cols-[auto_72px_1fr_80px_120px_100px_100px_auto] gap-0 items-center px-6 py-2">
      <Skeleton variant="circular" width={20} height={20} />
      <Skeleton variant="rectangular" width={72} height={72} className="rounded" />
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
      <Skeleton variant="text" width="80%" height={16} />
      <Skeleton variant="text" width="70%" height={16} />
      <Skeleton variant="text" width="60%" height={16} />
      <Skeleton variant="text" width="50%" height={16} />
      <Skeleton variant="circular" width={32} height={32} />
    </div>
  );
}

/**
 * 文件列表骨架屏（多行）
 */
export function FileListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <FileRowSkeleton key={i} />
      ))}
    </div>
  );
}
