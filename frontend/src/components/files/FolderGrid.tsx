import type { Folder } from '../../services/folders';
import FolderCard from './FolderCard';

interface FolderGridProps {
  folders: Folder[];
  selectedFolders: Set<string>;
  onSelect: (folderId: string) => void;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folderId: string) => void;
  onDrop: (e: React.DragEvent, folder: Folder) => void;
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
          onSelect={onSelect}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

