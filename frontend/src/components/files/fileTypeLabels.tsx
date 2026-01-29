/* eslint-disable react-refresh/only-export-components -- FILE_TYPE_LABELS is config with JSX, not a component */
import type { ReactNode } from 'react';
import {
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileArchive,
  FileSpreadsheet,
  File,
} from 'lucide-react';

function IconBadge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${className}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

export const FILE_TYPE_LABELS: Record<string, { label: string; icon: ReactNode; order: number }> = {
  image: {
    label: '图片',
    icon: (
      <IconBadge className="bg-blue-500/15 text-blue-400">
        <ImageIcon className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 1,
  },
  gif: {
    label: 'GIF',
    icon: (
      <IconBadge className="bg-emerald-500/15 text-emerald-400">
        <ImageIcon className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 2,
  },
  video: {
    label: '视频',
    icon: (
      <IconBadge className="bg-pink-500/15 text-pink-400">
        <Video className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 3,
  },
  audio: {
    label: '音频',
    icon: (
      <IconBadge className="bg-violet-500/15 text-violet-400">
        <Music className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 4,
  },
  'application/pdf': {
    label: 'PDF',
    icon: (
      <IconBadge className="bg-red-500/15 text-red-400">
        <FileText className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 5,
  },
  text: {
    label: '文本',
    icon: (
      <IconBadge className="bg-cyan-500/15 text-cyan-400">
        <FileText className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 6,
  },
  'application/zip': {
    label: '压缩包',
    icon: (
      <IconBadge className="bg-amber-500/15 text-amber-400">
        <FileArchive className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 7,
  },
  application: {
    label: '文档',
    icon: (
      <IconBadge className="bg-teal-500/15 text-teal-400">
        <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 8,
  },
  other: {
    label: '其他',
    icon: (
      <IconBadge className="bg-slate-500/15 text-slate-400">
        <File className="h-4 w-4" strokeWidth={2} />
      </IconBadge>
    ),
    order: 99,
  },
};
