import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

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
        "glass-panel-soft flex flex-col items-center justify-center px-[clamp(0.75rem,2vw,1rem)] py-[clamp(3rem,8vw,4rem)] text-center",
        className,
      )}
      data-oid="4twbe5_"
    >
      {icon && (
        <div
          className="mb-[clamp(0.75rem,2vw,1rem)] flex h-[clamp(4rem,10vw,5rem)] w-[clamp(4rem,10vw,5rem)] items-center justify-center rounded-full bg-[rgba(var(--rgb-white),0.06)] ring-1 ring-[var(--color-border-soft)]"
          data-oid="2z8bf-l"
        >
          {icon}
        </div>
      )}
      <p
        className="text-[clamp(1rem,2.3vw,1.125rem)] font-medium text-[var(--color-text-secondary)]"
        data-oid="b_tqwby"
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-[clamp(0.2rem,0.7vw,0.25rem)] max-w-[24rem] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--color-text-muted)]"
          data-oid="eio-46a"
        >
          {description}
        </p>
      )}
      {action && (
        <div className="mt-[clamp(0.75rem,2vw,1rem)]" data-oid="vus2in8">
          {action}
        </div>
      )}
    </div>
  );
}
