import type { FileMetadata } from '../../../types/files';
import type { Folder } from '../../../types/folders';
import FileCard from './FileCard';

interface FileGridProps {
  files: FileMetadata[];
  selectedFiles: Set<string>;
  onSelect: (fileId: string, selected: boolean) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata | Folder, type: 'file' | 'folder') => void;
  onDragStart: (fileId: string, e: React.DragEvent) => void;
  openFileMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
}

/**
 * 文件网格组件 v2
 *
 * 设计原则：
 * 1. 不使用 memo - 组件本身足够简单，memo 开销反而更大
 * 2. 子组件 FileCard 自带 memo + 自定义比较，已足够高效
 * 3. 使用 CSS content-visibility 实现原生虚拟化（浏览器自动优化）
 */
export default function FileGrid({
  files,
  selectedFiles,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onDelete,
  onDragStart,
  openFileMenuId,
  onToggleMenu,
  onCloseMenu,
}: FileGridProps) {
  if (files.length === 0) return null;
  const uniqueFiles =
    files.length <= 1
      ? files
      : (() => {
          const seen = new Set<string>();
          const deduped: FileMetadata[] = [];
          for (const file of files) {
            if (seen.has(file.id)) continue;
            seen.add(file.id);
            deduped.push(file);
          }
          return deduped;
        })();

  return (
    <div
      // 去掉 content-visibility:auto，避免少数浏览器在页面刚渲染完时延迟鼠标事件 / hover 呈现
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
    >
      {uniqueFiles.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          isSelected={selectedFiles.has(file.id)}
          onSelect={(id) => onSelect(id, !selectedFiles.has(id))}
          onPreview={onPreview}
          onShare={onShare}
          onDownload={onDownload}
          onDelete={() => onDelete(file, 'file')}
          onDragStart={(e) => onDragStart(file.id, e)}
          isMenuOpen={openFileMenuId === file.id}
          onToggleMenu={onToggleMenu}
          onCloseMenu={onCloseMenu}
        />
      ))}
    </div>
  );
}
