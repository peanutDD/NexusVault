import { apiPath } from "../../../config/env";
import { cn } from "../../../utils/cn";

export default function MarkdownImage({
  src,
  ...props
}: {
  src?: string;
  [key: string]: unknown;
}) {
  const raw = typeof src === "string" ? src : "";
  const normalized = raw
    .trim()
    .replace(/^([`'"]+)([\s\S]*?)\1$/, "$2")
    .trim();
  const isAbsolute =
    normalized.startsWith("http://") || normalized.startsWith("https://");
  const proxiedSrc = isAbsolute
    ? apiPath(`/proxy/image?url=${encodeURIComponent(normalized)}`)
    : normalized;
  const { className, ...rest } = props as {
    className?: string;
    [key: string]: unknown;
  };

  return (
    <img
      src={proxiedSrc ? proxiedSrc : undefined}
      width={800}
      height={600}
      loading="lazy"
      className={cn(
        "my-[clamp(0.585rem,1.35vw,0.75rem)] mx-auto block max-w-full max-h-[60vh] rounded-[clamp(0.3rem,0.8vw,0.375rem)] border object-contain",
        "border-[var(--preview-markdown-img-border)] bg-[var(--preview-markdown-img-bg)]",
        typeof className === "string" ? className : undefined,
      )}
      {...rest}
    />
  );
}
