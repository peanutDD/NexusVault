import { useState, useCallback, useEffect, useRef } from 'react';
import { folderService } from '../../../services/folders';
import type { Folder } from '../../../types';
import { getErrorMessage } from '../../../utils/error';
import { useDialog } from '../../../hooks/common/useDialog';
import { validateFolderName } from '../../../hooks/folders/useFolderValidation';
import './CreateFolderDialog.css';

interface CreateFolderDialogProps {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

/**
 * Create folder dialog
 */
export default function CreateFolderDialog({
  open,
  parentId,
  onClose,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { handleBackdropClick } = useDialog({
    open,
    onClose,
    loading,
    autoFocusRef: inputRef,
  });

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const validation = validateFolderName(name);
      if (!validation.valid) {
        setError(validation.error ?? 'Validation failed');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const created = await folderService.create(name.trim(), parentId);
        onCreated(created);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to create folder'));
      } finally {
        setLoading(false);
      }
    },
    [name, parentId, onCreated, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="createFolderDialogScope"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="createFolderDialogPanel relative w-full max-w-sm animate-fade-in overflow-hidden rounded-2xl border border-white/15 p-6 shadow-2xl text-white"
        >
          <div
            className="createFolderDialogHighlight pointer-events-none absolute inset-0 rounded-2xl"
            aria-hidden
          />
          <div className="relative z-10">
            <h2 className="mb-4 text-lg font-semibold text-white drop-shadow-sm">New Folder</h2>

            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                placeholder="Enter folder name"
                maxLength={50}
                className="createFolderDialogInput mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 shadow-inner transition-colors focus:border-[#6C5DD3] focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/40"
                disabled={loading}
              />

              {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="createFolderDialogCancelBtn flex-1 rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="createFolderDialogSubmitBtn flex-1 rounded-xl border border-[#6C5DD3]/40 bg-[#6C5DD3]/30 py-3 text-sm font-medium text-white transition-colors hover:bg-[#6C5DD3]/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
