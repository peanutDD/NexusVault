import { useCallback } from "react";
import type { Folder } from "../../../types/folders";
import FolderCard from "./FolderCard";

interface FolderGridProps {
  folders: Folder[];
  selectedFolders: Set<string>;
  onSelect: (folderId: string, selected: boolean) => void;
  onOpen: (folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folderId: string) => void;
  onDrop: (folderId: string, fileIds: string[], folderIds: string[]) => void;
  openFolderMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
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
  openFolderMenuId,
  onToggleMenu,
  onCloseMenu,
}: FolderGridProps) {
  const handleDeleteFolder = useCallback(
    (folder: Folder) => onDelete(folder.id),
    [onDelete],
  );
  const handleMobileFolderDrop = useCallback(
    (targetFolderId: string, sourceFolderId: string) => {
      onDrop(targetFolderId, [], [sourceFolderId]);
    },
    [onDrop],
  );

  if (folders.length === 0) return null;

  return (
    <div
      className="grid grid-cols-3 gap-x-[clamp(0.4rem,1vw,0.5rem)] gap-y-[clamp(0.6rem,1.4vw,0.75rem)] sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
      data-oid="n3w0d77"
    >
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          isSelected={selectedFolders.has(folder.id)}
          onSelect={onSelect}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={handleDeleteFolder}
          onDrop={onDrop}
          onMobileFolderDrop={handleMobileFolderDrop}
          isMenuOpen={openFolderMenuId === folder.id}
          onToggleMenu={onToggleMenu}
          onCloseMenu={onCloseMenu}
          data-oid="iorwr2u"
        />
      ))}
    </div>
  );
}
