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

export default function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        sizeClasses[size],
        "border-[var(--spinner-track-color)] border-t-[var(--spinner-accent-color)] rounded-full animate-spin",
        className,
      )}
      aria-hidden
      role="status"
      aria-label="加载中"
      data-oid="jsww135"
    />
  );
}
