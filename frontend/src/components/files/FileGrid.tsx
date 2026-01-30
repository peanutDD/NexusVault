import type { FileMetadata, Folder } from '../../types';
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
}

export default function FileGrid({
  files,
  selectedFiles,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onDelete,
  onDragStart,
}: FileGridProps) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          isSelected={selectedFiles.has(file.id)}
          onSelect={(id) => onSelect(id, !selectedFiles.has(id))}
          onPreview={onPreview}
          onShare={onShare}
          onDownload={onDownload}
          onDelete={() => onDelete(file, 'file')}
          onDragStart={(e, file) => onDragStart(file.id, e)}
        />
      ))}
    </div>
  );
}

