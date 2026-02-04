import type { Folder } from '../../../types';
import FolderCard from './FolderCard';

interface FolderGridProps {
  folders: Folder[];
  selectedFolders: Set<string>;
  onSelect: (folderId: string, selected: boolean) => void;
  onOpen: (folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folderId: string) => void;
  onDrop: (folderId: string, fileIds: string[], folderIds: string[]) => void;
}

/**
 * 文件夹网格组件 v2
 *
 * 设计原则：
 * 1. 不使用 memo - 组件本身足够简单
 * 2. 子组件 FolderCard 自带 memo，已足够高效
 * 3. 文件夹数量通常较少，无需虚拟化
 */
export default function FolderGrid({
  folders,
  selectedFolders,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onDrop,
}: FolderGridProps) {
  if (folders.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          isSelected={selectedFolders.has(folder.id)}
          onSelect={(id) => onSelect(id, !selectedFolders.has(id))}
          onOpen={(f) => onOpen(f.id)}
          onRename={onRename}
          onDelete={() => onDelete(folder.id)}
          onDrop={(e, target) => {
            const fileId = e.dataTransfer.getData('application/file-id');
            const folderId = e.dataTransfer.getData('application/folder-id');
            onDrop(target.id, fileId ? [fileId] : [], folderId ? [folderId] : []);
          }}
        />
      ))}
    </div>
  );
}
