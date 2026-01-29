import { memo } from 'react';
import { cn } from '../../utils/cn';

type MacActionVariant = 'selected' | 'move' | 'share' | 'download' | 'delete';

interface MacActionIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: MacActionVariant;
}

const BOOTSTRAP_ICON: Record<MacActionVariant, string> = {
  selected: 'bi-check-circle-fill',
  move: 'bi-arrow-left-right',
  share: 'bi-share-fill',
  download: 'bi-download',
  delete: 'bi-trash-fill',
};

/**
 * macOS 风格动作图标（彩色圆角方块底 + 高光），图标来自 Bootstrap Icons。
 * @see https://icons.getbootstrap.com/
 */
export const MacActionIcon = memo(function MacActionIcon({
  variant,
  className,
  ...props
}: MacActionIconProps) {
  const biClass = BOOTSTRAP_ICON[variant];

  return (
    <span
      className={cn('macActionIcon', `macActionIcon--${variant}`, className)}
      aria-hidden="true"
      {...props}
    >
      <i className={cn('macActionIconGlyph', 'bi', biClass)} aria-hidden="true" />
    </span>
  );
});

