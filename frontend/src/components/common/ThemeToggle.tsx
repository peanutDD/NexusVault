//! # Theme Toggle Component
//!
//! 主题切换按钮组件，支持深色/浅色模式切换。

import { Moon, Sparkles, Sun } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";
import { cn } from "../../utils/cn";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * 主题切换按钮
 *
 * 点击可在深色和浅色模式之间切换。
 */
export default function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { effectiveTheme, toggleTheme } = useThemeStore();
  const nextThemeLabel =
    effectiveTheme === "dark"
      ? "浅色"
      : effectiveTheme === "light"
        ? "紫色"
        : "深色";
  const currentThemeLabel =
    effectiveTheme === "dark"
      ? "深色"
      : effectiveTheme === "light"
        ? "浅色"
        : "紫色";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "nav-btn inline-flex items-center justify-center whitespace-nowrap",
        "nav-ui-fluid font-semibold tracking-wide text-[var(--nav-btn-text)]",
        "bg-[var(--nav-btn-bg)] border border-[var(--nav-btn-border)]",
        "hover:bg-[var(--nav-btn-bg-hover)] hover:border-[var(--nav-btn-border-hover)]",
        "active:translate-y-px transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--nav-surface-bg)]",
        className,
      )}
      aria-label={`切换主题：当前${currentThemeLabel}，点击切到${nextThemeLabel}`}
      title={`当前: ${currentThemeLabel}（点击切换）`}
      data-oid="6nbyj70"
    >
      <div
        className={cn("flex items-center", showLabel ? "gap-2" : "gap-0")}
        data-oid="clfwf:n"
      >
        {effectiveTheme === "light" ? (
          <Sun
            className="h-5 w-5 transition-transform duration-200 hover:rotate-12"
            aria-hidden="true"
            data-oid="zeovdrg"
          />
        ) : effectiveTheme === "dark" ? (
          <Moon
            className="h-5 w-5 transition-transform duration-200 hover:rotate-12"
            aria-hidden="true"
            data-oid="m1.w5ph"
          />
        ) : (
          <Sparkles
            className="h-5 w-5 transition-transform duration-200 hover:rotate-12"
            aria-hidden="true"
            data-oid="yk8.6nq"
          />
        )}
        {showLabel && (
          <span className="text-sm" data-oid="6rqexbj">
            {currentThemeLabel}
          </span>
        )}
      </div>
    </button>
  );
}
