import { Loader2 } from "lucide-react";
import { cn } from "../../../utils/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-[clamp(1rem,2.25vw,1.25rem)] h-[clamp(1rem,2.25vw,1.25rem)] border-2",
  md: "w-[clamp(2.25rem,4.5vw,2.5rem)] h-[clamp(2.25rem,4.5vw,2.5rem)] border-2",
  lg: "w-[clamp(3.75rem,7.2vw,4rem)] h-[clamp(3.75rem,7.2vw,4rem)] border-4",
} as const;

const iconSizeClasses = {
  sm: "w-[clamp(1rem,2.25vw,1.25rem)] h-[clamp(1rem,2.25vw,1.25rem)]",
  md: "w-[clamp(1.25rem,2.7vw,1.5rem)] h-[clamp(1.25rem,2.7vw,1.5rem)]",
  lg: "w-[clamp(1.75rem,3.6vw,2rem)] h-[clamp(1.75rem,3.6vw,2rem)]",
} as const;

export default function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className="appSpinnerStatus inline-flex items-center justify-center"
      role="status"
      aria-label="加载中"
      data-oid="jsww135"
    >
      <span className="neu-raised-sm appSpinnerShell inline-flex items-center justify-center rounded-full">
        <span
          className={cn(
            "appSpinnerRing",
            sizeClasses[size],
            "border-[var(--spinner-track-color)] border-t-[var(--spinner-accent-color)] rounded-full animate-spin",
            className,
          )}
          aria-hidden="true"
        />
        <Loader2
          className={cn("appSpinnerIcon animate-spin", iconSizeClasses[size])}
          aria-hidden="true"
        />
      </span>
    </span>
  );
}
