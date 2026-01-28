import { memo } from 'react';
import { cn } from '../../utils/cn';
import { ArrowRightLeft, CheckCircle2, Download, Share2, Trash2 } from 'lucide-react';

type MacActionVariant = 'selected' | 'move' | 'share' | 'download' | 'delete';

interface MacActionIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: MacActionVariant;
}

/**
 * macOS 风格动作图标（更接近：彩色圆角方块底 + 高光 + 白色线条）
 * 说明：不使用系统资源；glyph 使用 lucide 线框保证清晰与一致。
 */
export const MacActionIcon = memo(function MacActionIcon({
  variant,
  className,
  ...props
}: MacActionIconProps) {
  const Icon = (() => {
    switch (variant) {
      case 'move':
        return ArrowRightLeft;
      case 'share':
        return Share2;
      case 'download':
        return Download;
      case 'delete':
        return Trash2;
      case 'selected':
      default:
        return CheckCircle2;
    }
  })();

  return (
    <span
      className={cn('macActionIcon', `macActionIcon--${variant}`, className)}
      aria-hidden="true"
      {...props}
    >
      <Icon className="macActionIconGlyph" aria-hidden="true" />
    </span>
  );
});

