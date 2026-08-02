import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import Modal from "../../common/dialog/Modal";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from "../../../services/fileListService";
import { tagsService } from "../../../services/tags";
import type { FileMetadata, FileTag } from "../../../types/files";
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
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [deletedTagIds, setDeletedTagIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const tags = useQuery({ queryKey: ["tags"], queryFn: tagsService.list });
  const visibleTags = useMemo(
    () => (tags.data ?? []).filter((tag) => !deletedTagIds.has(tag.id)),
    [deletedTagIds, tags.data],
  );

  const invalidateTagBackedState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tags"] }),
      queryClient.invalidateQueries({ queryKey: ["files"] }),
      queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY }),
    ]);
  };

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

  const updateTag = async (tag: FileTag) => {
    const name = (tagDrafts[tag.id] ?? tag.name).trim();
    if (!name) return;
    try {
      await tagsService.update(tag.id, { name, color: tag.color });
      await invalidateTagBackedState();
    } catch (err) {
      setError(getErrorMessage(err, "更新标签失败"));
    }
  };

  const removeTag = async (tag: FileTag) => {
    try {
      await tagsService.remove(tag.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
      setDeletedTagIds((prev) => new Set([...prev, tag.id]));
      await invalidateTagBackedState();
    } catch (err) {
      setError(getErrorMessage(err, "删除标签失败"));
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
            className="neu-inset singleShareDialogField min-w-0 flex-1 rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-field-text)]"
            placeholder="New tag"
          />
          <button type="button" onClick={create} className="neu-raised-sm singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] text-[var(--dialog-action-text)] active:shadow-[var(--neu-pressed-shadow)]">
            Add
          </button>
        </div>
        <div
          data-testid="manage-tags-list"
          className="neu-inset fileActionDialogInsetList max-h-[18rem] overflow-auto rounded-[clamp(0.5rem,1.1vw,0.625rem)] p-[clamp(0.58rem,1.35vw,0.75rem)]"
        >
          {visibleTags.map((tag) => (
            <div
              key={tag.id}
              className="mb-[clamp(0.39rem,0.9vw,0.5rem)] grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-panel-text)]"
            >
              <label className="flex items-center gap-[clamp(0.39rem,0.9vw,0.5rem)]">
                <input
                  type="checkbox"
                  aria-label={`将文件归类到标签 ${tag.name}`}
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
                <span
                  className="h-[0.7rem] w-[0.7rem] rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
              </label>
              <input
                aria-label={`重命名标签 ${tag.name}`}
                value={tagDrafts[tag.id] ?? tag.name}
                onChange={(event) =>
                  setTagDrafts((current) => ({
                    ...current,
                    [tag.id]: event.target.value,
                  }))
                }
                className="neu-inset singleShareDialogField min-w-0 rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.4875rem,1.125vw,0.625rem)] py-[clamp(0.2925rem,0.675vw,0.375rem)] text-[var(--dialog-field-text)]"
              />
              <button
                type="button"
                aria-label={`保存标签 ${tag.name}`}
                title={`保存标签 ${tag.name}`}
                onClick={() => updateTag(tag)}
                className="neu-raised-sm singleShareDialogAction inline-flex h-[clamp(1.7rem,3.8vw,2.1rem)] w-[clamp(1.7rem,3.8vw,2.1rem)] items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 text-[var(--dialog-action-text)] active:shadow-[var(--neu-pressed-shadow)]"
              >
                <Save className="h-[clamp(0.82rem,1.8vw,1rem)] w-[clamp(0.82rem,1.8vw,1rem)]" />
              </button>
              <button
                type="button"
                aria-label={`删除标签 ${tag.name}`}
                title={`删除标签 ${tag.name}`}
                onClick={() => removeTag(tag)}
                className="neu-raised-sm singleShareDialogAction inline-flex h-[clamp(1.7rem,3.8vw,2.1rem)] w-[clamp(1.7rem,3.8vw,2.1rem)] items-center justify-center rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 text-[var(--dialog-accent-rose-text)] active:shadow-[var(--neu-pressed-shadow)]"
              >
                <Trash2 className="h-[clamp(0.82rem,1.8vw,1rem)] w-[clamp(0.82rem,1.8vw,1rem)]" />
              </button>
            </div>
          ))}
          {!visibleTags.length && <p className="text-[var(--dialog-label-text)]">暂无标签。</p>}
        </div>
        <button type="button" onClick={save} className="neu-raised-sm singleShareDialogPrimary w-full rounded-[clamp(0.4rem,1vw,0.5rem)] border-0 px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[var(--dialog-primary-btn-text)] active:shadow-[var(--neu-pressed-shadow)]">
          保存
        </button>
      </div>
    </Modal>
  );
}
