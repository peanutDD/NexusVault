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
          onOpen={(folder) => onOpen(folder.id)}
          onRename={onRename}
          onDelete={() => onDelete(folder.id)}
          onDrop={(_, targetFolder) => onDrop(targetFolder.id, [], [])}
        />
      ))}
    </div>
  );
}

