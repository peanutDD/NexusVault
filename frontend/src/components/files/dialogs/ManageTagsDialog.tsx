import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../../common/dialog/Modal";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from "../../../services/fileListService";
import { tagsService } from "../../../services/tags";
import type { FileMetadata } from "../../../types/files";
import { getErrorMessage } from "../../../utils/error";

interface ManageTagsDialogProps {
  file: FileMetadata;
  onClose: () => void;
}

export default function ManageTagsDialog({ file, onClose }: ManageTagsDialogProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((file.tags ?? []).map((tag) => tag.id)),
  );
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tags = useQuery({ queryKey: ["tags"], queryFn: tagsService.list });

  const save = async () => {
    try {
      await tagsService.setFileTags(file.id, Array.from(selected));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["files"] }),
        queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY }),
      ]);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "保存标签失败"));
    }
  };

  const create = async () => {
    const name = newTag.trim();
    if (!name) return;
    try {
      const tag = await tagsService.create({ name, color: "#8b5cf6" });
      setSelected((prev) => new Set([...prev, tag.id]));
      setNewTag("");
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
    } catch (err) {
      setError(getErrorMessage(err, "创建标签失败"));
    }
  };

  return (
    <Modal
      title="管理标签"
      description={file.original_filename}
      onClose={onClose}
      maxWidth="sm"
      variant="glass"
      panelClassName="fileActionDialogShell"
    >
      <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]">
        {error && <ErrorMessage type="error" message={error} onClose={() => setError(null)} />}
        <div className="flex gap-[clamp(0.39rem,0.9vw,0.5rem)]">
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            className="singleShareDialogField min-w-0 flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-field-text)]"
            placeholder="New tag"
          />
          <button type="button" onClick={create} className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.78rem,1.8vw,1rem)] text-[var(--dialog-action-text)]">
            Add
          </button>
        </div>
        <div
          data-testid="manage-tags-list"
          className="fileActionDialogInsetList max-h-[18rem] overflow-auto rounded-[clamp(0.5rem,1.1vw,0.625rem)] bg-[var(--neu-inset-bg)] p-[clamp(0.58rem,1.35vw,0.75rem)]"
        >
          {(tags.data ?? []).map((tag) => (
            <label key={tag.id} className="mb-[clamp(0.39rem,0.9vw,0.5rem)] flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-panel-text)]">
              <input
                type="checkbox"
                checked={selected.has(tag.id)}
                onChange={(event) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (event.target.checked) next.add(tag.id);
                    else next.delete(tag.id);
                    return next;
                  });
                }}
              />
              <span className="h-[0.7rem] w-[0.7rem] rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </label>
          ))}
          {!tags.data?.length && <p className="text-[var(--dialog-label-text)]">暂无标签。</p>}
        </div>
        <button type="button" onClick={save} className="singleShareDialogPrimary w-full rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[image:var(--dialog-primary-btn-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-primary-btn-text)] shadow-[var(--dialog-primary-btn-shadow)]">
          保存
        </button>
      </div>
    </Modal>
  );
}
