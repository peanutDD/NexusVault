import { cn } from "../../../utils/cn";

interface SelectionCheckboxProps {
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 是否总是显示（默认只在 hover 时显示未选中状态） */
  alwaysVisible?: boolean;
  /** 位置类名（默认 absolute left-[clamp(0.39rem,0.9vw,0.5rem)] top-[clamp(0.39rem,0.9vw,0.5rem)]） */
  positionClassName?: string;
  /** 大小 */
  size?: "sm" | "md" | "responsive";
}

/**
 * 选择框组件 v3
 *
 * 核心优化：
 * 1. 使用 visibility 替代 opacity - visibility 变化不触发重绘，更高效
 * 2. 添加 will-change 提示 - 让浏览器提前优化图层
 * 3. 使用 CSS contain - 隔离样式计算范围
 * 4. 选中状态始终显示，无需 hover 检测
 */
export function SelectionCheckbox({
  isSelected,
  onClick,
  alwaysVisible = false,
  positionClassName = "absolute left-[clamp(0.39rem,0.9vw,0.5rem)] top-[clamp(0.39rem,0.9vw,0.5rem)]",
  size = "md",
}: SelectionCheckboxProps) {
  const isSmall = size === "sm";
  const isResponsive = size === "responsive";

  // 选中状态：始终显示
  // 未选中状态：默认隐藏，hover 时显示
  const shouldHideByDefault = !isSelected && !alwaysVisible;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        positionClassName,
        "z-10 flex cursor-pointer items-center justify-center",
        // 使用 visibility 替代 opacity，性能更好
        // visibility: hidden 的元素不参与事件处理，但保留布局
        shouldHideByDefault && "invisible group-hover:visible",
        // will-change 提示浏览器优化
        "[will-change:visibility] [contain:layout_style]",
        isResponsive
          ? "h-[clamp(0.95rem,1.45vw,1.25rem)] w-[clamp(0.95rem,1.45vw,1.25rem)]"
          : isSmall
            ? "h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]"
            : "h-[clamp(1rem,2.25vw,1.25rem)] w-[clamp(1rem,2.25vw,1.25rem)]",
      )}
      aria-label={isSelected ? "取消选择" : "选择"}
      data-oid="giuccid"
    >
      {isSelected ? (
        <span
          className={cn(
            "card-checkbox-outer-crystal card-checkbox-selected flex items-center justify-center rounded-full bg-[var(--selection-check-surface)] transition-colors duration-150 group-hover:bg-[var(--selection-check-surface-hover)]",
            isResponsive
              ? "h-[clamp(0.72rem,1.1vw,0.95rem)] w-[clamp(0.72rem,1.1vw,0.95rem)]"
              : isSmall
                ? "h-[clamp(0.585rem,1.35vw,0.75rem)] w-[clamp(0.585rem,1.35vw,0.75rem)]"
                : "h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]",
          )}
          data-oid="2.imuw_"
        >
          <svg
            className={cn(
              "text-[var(--selection-check-icon)] transition-colors duration-150 group-hover:text-[var(--selection-check-icon-hover)]",
              isResponsive
                ? "h-[clamp(0.45rem,0.75vw,0.62rem)] w-[clamp(0.45rem,0.75vw,0.62rem)]"
                : isSmall
                  ? "h-[clamp(0.39rem,0.9vw,0.5rem)] w-[clamp(0.39rem,0.9vw,0.5rem)]"
                  : "h-[clamp(0.4875rem,1.125vw,0.625rem)] w-[clamp(0.4875rem,1.125vw,0.625rem)]",
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={3}
            data-oid=".ut6.kf"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              data-oid="5m1uzy0"
            />
          </svg>
        </span>
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-[var(--selection-check-surface)] transition-colors duration-150 group-hover:bg-[var(--selection-check-surface-hover)]",
            isResponsive
              ? "h-[clamp(0.72rem,1.1vw,0.95rem)] w-[clamp(0.72rem,1.1vw,0.95rem)]"
              : isSmall
                ? "h-[clamp(0.585rem,1.35vw,0.75rem)] w-[clamp(0.585rem,1.35vw,0.75rem)]"
                : "h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)]",
          )}
          data-oid="4jdh1lb"
        >
          <span
            className={cn(
              "rounded-full border border-[var(--selection-check-ring)] transition-colors duration-150 group-hover:border-[var(--selection-check-ring-hover)]",
              isResponsive
                ? "h-[clamp(0.35rem,0.6vw,0.52rem)] w-[clamp(0.35rem,0.6vw,0.52rem)]"
                : isSmall
                  ? "h-[clamp(0.2925rem,0.675vw,0.375rem)] w-[clamp(0.2925rem,0.675vw,0.375rem)]"
                  : "h-[clamp(0.4875rem,1.125vw,0.625rem)] w-[clamp(0.4875rem,1.125vw,0.625rem)]",
            )}
            data-oid="v3q45d5"
          />
        </span>
      )}
    </button>
  );
}

export default SelectionCheckbox;
