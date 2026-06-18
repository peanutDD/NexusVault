/* eslint-disable react-refresh/only-export-components -- FILE_TYPE_LABELS is config with JSX, not a component */
import { Pin } from "lucide-react";
import type { ReactNode } from "react";

function IconBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex h-[clamp(1.5rem,3.15vw,1.75rem)] w-[clamp(1.5rem,3.15vw,1.75rem)] shrink-0 items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] text-[clamp(0.875rem,2vw,1rem)] ${className}`}
      aria-hidden
      data-oid="cw-rwls"
    >
      {children}
    </span>
  );
}

const TYPE_BADGE_CLASS =
  "bg-[var(--file-type-badge-bg-1)] text-[var(--file-type-badge-text-1)]";

export const FILE_TYPE_LABELS: Record<
  string,
  { label: string; icon: ReactNode; order: number }
> = {
  pinned: {
    label: "Pinned",
    icon: (
      <IconBadge
        className={`${TYPE_BADGE_CLASS} fileListPinnedGroupIconBadge`}
        data-oid="pinned-type"
      >
        <Pin
          className="fileListPinnedGroupIcon h-[0.95em] w-[0.95em]"
          aria-hidden
          data-oid="pinned-icon"
        />
      </IconBadge>
    ),

    order: 0,
  },
  image: {
    label: "Images",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="1amofzj">
        <i
          className="bi bi-file-earmark-image-fill"
          aria-hidden
          data-oid="qzw.aw3"
        />
      </IconBadge>
    ),

    order: 1,
  },
  gif: {
    label: "GIF",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="r-3v:rl">
        <i
          className="bi bi-file-earmark-image-fill"
          aria-hidden
          data-oid="qsbec4t"
        />
      </IconBadge>
    ),

    order: 2,
  },
  video: {
    label: "Videos",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="ip:h.el">
        <i className="bi bi-camera-video-fill" aria-hidden data-oid=".3vr9rc" />
      </IconBadge>
    ),

    order: 3,
  },
  audio: {
    label: "Audio",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="56xe8mj">
        <i
          className="bi bi-file-earmark-music-fill"
          aria-hidden
          data-oid="44w.:r0"
        />
      </IconBadge>
    ),

    order: 4,
  },
  "application/pdf": {
    label: "PDF",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="pjlq5r:">
        <i className="bi bi-file-pdf-fill" aria-hidden data-oid="zjfaxcj" />
      </IconBadge>
    ),

    order: 5,
  },
  text: {
    label: "Text",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="tuzscy7">
        <i className="bi bi-file-text-fill" aria-hidden data-oid="318vr3z" />
      </IconBadge>
    ),

    order: 6,
  },
  "application/zip": {
    label: "Archives",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="svswat2">
        <i className="bi bi-file-zip-fill" aria-hidden data-oid="46.uvdz" />
      </IconBadge>
    ),

    order: 7,
  },
  application: {
    label: "Docs",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="rq-1ui0">
        <i
          className="bi bi-file-spreadsheet-fill"
          aria-hidden
          data-oid="43q_yej"
        />
      </IconBadge>
    ),

    order: 8,
  },
  other: {
    label: "Others",
    icon: (
      <IconBadge className={TYPE_BADGE_CLASS} data-oid="r1s0ghs">
        <i className="bi bi-file-earmark-fill" aria-hidden data-oid="27p5-nz" />
      </IconBadge>
    ),

    order: 99,
  },
};
