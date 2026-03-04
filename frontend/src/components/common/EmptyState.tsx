import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  /** 主标题，如「暂无文件」「文件夹为空」 */
  title: string;
  /** 次级说明，如「上传你的第一个文件吧」 */
  description?: string;
  /** 可选图标区域（居中显示） */
  icon?: ReactNode;
  /** 可选操作区域（按钮等） */
  action?: ReactNode;
  /** 额外样式类 */
  className?: string;
}

/**
 * 通用空状态组件
 *
 * 用于「暂无数据 / 列表为空 / 搜索无结果」等场景。
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'glass-panel-soft flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(var(--rgb-white),0.06)] ring-1 ring-[var(--color-border-soft)]">
          {icon}
        </div>
      )}
      <p className="text-lg font-medium text-[var(--color-text-secondary)]">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-text-muted)] max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
