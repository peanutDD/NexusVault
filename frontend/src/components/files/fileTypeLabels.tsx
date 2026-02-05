/* eslint-disable react-refresh/only-export-components -- FILE_TYPE_LABELS is config with JSX, not a component */
import type { ReactNode } from 'react';

function IconBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base ${className}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

const TYPE_BADGE_CLASS = 'bg-white/10 text-white/90';

export const FILE_TYPE_LABELS: Record<string, { label: string; icon: ReactNode; order: number }> = {
  image: {
    label: 'Images',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-earmark-image-fill" aria-hidden />
      </IconBadge>
    ),
    order: 1,
  },
  gif: {
    label: 'GIF',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-earmark-image-fill" aria-hidden />
      </IconBadge>
    ),
    order: 2,
  },
  video: {
    label: 'Videos',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-camera-video-fill" aria-hidden />
      </IconBadge>
    ),
    order: 3,
  },
  audio: {
    label: 'Audio',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-earmark-music-fill" aria-hidden />
      </IconBadge>
    ),
    order: 4,
  },
  'application/pdf': {
    label: 'PDF',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-pdf-fill" aria-hidden />
      </IconBadge>
    ),
    order: 5,
  },
  text: {
    label: 'Text',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-text-fill" aria-hidden />
      </IconBadge>
    ),
    order: 6,
  },
  'application/zip': {
    label: 'Archives',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-zip-fill" aria-hidden />
      </IconBadge>
    ),
    order: 7,
  },
  application: {
    label: 'Docs',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-spreadsheet-fill" aria-hidden />
      </IconBadge>
    ),
    order: 8,
  },
  other: {
    label: 'Others',
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS}>
        <i className="bi bi-file-earmark-fill" aria-hidden />
      </IconBadge>
    ),
    order: 99,
  },
};
