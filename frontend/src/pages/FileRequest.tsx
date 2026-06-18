import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ErrorMessage from "../components/common/feedback/ErrorMessage";
import { fileRequestService, type PublicFileRequest } from "../services/fileRequests";
import { getErrorMessage } from "../utils/error";
import { formatFileSize } from "../utils/format";

export default function FileRequest() {
  const { token } = useParams<{ token: string }>();
  const [config, setConfig] = useState<PublicFileRequest | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterNote, setSubmitterNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fileRequestService
      .getPublic(token)
      .then((data) => {
        setConfig(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "上传请求不可用")))
      .finally(() => setLoading(false));
  }, [token]);

  const upload = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!token || !files.length) return;
      setUploading(true);
      setError(null);
      setMessage(null);
      try {
        const result = await fileRequestService.uploadPublic(token, files, {
          submitter_email: submitterEmail.trim() || undefined,
          submitter_note: submitterNote.trim() || undefined,
        });
        setMessage(`已提交 ${result.submission.file_count} 个文件，等待审核。`);
        setFiles([]);
        setSubmitterEmail("");
        setSubmitterNote("");
      } catch (err) {
        setError(getErrorMessage(err, "上传失败"));
      } finally {
        setUploading(false);
      }
    },
    [files, submitterEmail, submitterNote, token],
  );

  const accepts = config?.allowed_mime_prefixes?.length
    ? config.allowed_mime_prefixes.join(", ")
    : "Any file type";

  return (
    <div
      data-testid="file-request-page-shell"
      className="fileRequestPageShell fileRequestPublicShell neuromorphic-style flex min-h-screen items-center justify-center overflow-x-hidden px-[clamp(0.78rem,2.6vw,1.25rem)] py-[clamp(1rem,4vw,2.5rem)]"
    >
      <div
        data-testid="file-request-page-card"
        className="sharePageCard fileRequestPublicCard w-full max-w-[min(100%,38rem)] self-start overflow-hidden rounded-[clamp(1.15rem,3vw,1.65rem)] p-[clamp(1.25rem,3.5vw,2rem)] sm:self-center"
      >
        <h1 className="text-[clamp(1.55rem,4.8vw,2.35rem)] font-extrabold leading-tight text-[var(--file-request-public-title)]">
          {config?.title ?? "File Request"}
        </h1>
        {config?.description && (
          <p className="mt-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.85rem,2vw,1rem)] text-[var(--file-request-public-muted)]">
            {config.description}
          </p>
        )}

        {loading ? (
          <p className="fileRequestPublicInset mt-[clamp(1rem,2.25vw,1.25rem)] rounded-[clamp(0.85rem,2vw,1rem)] p-[clamp(0.9rem,2vw,1.1rem)] text-[var(--file-request-public-muted)]">
            加载中…
          </p>
        ) : (
          <form onSubmit={upload} className="mt-[clamp(1.15rem,2.8vw,1.6rem)] space-y-[clamp(0.95rem,2.25vw,1.25rem)]">
            {error && <ErrorMessage type="error" message={error} onClose={() => setError(null)} />}
            {message && <ErrorMessage type="info" message={message} onClose={() => setMessage(null)} />}

            <div
              data-testid="file-request-limits-panel"
              className="shareFileInfoPanel fileRequestPublicInset grid gap-[clamp(0.55rem,1.3vw,0.75rem)] rounded-[clamp(0.9rem,2.1vw,1.15rem)] p-[clamp(0.95rem,2.4vw,1.25rem)] text-[clamp(0.84rem,2vw,1rem)] sm:grid-cols-3"
            >
              <p className="fileRequestPublicStat">
                <span>Allowed</span>
                <strong>{accepts}</strong>
              </p>
              <p className="fileRequestPublicStat">
                <span>Max size</span>
                <strong>{config?.max_file_size ? formatFileSize(config.max_file_size) : "No limit"}</strong>
              </p>
              <p className="fileRequestPublicStat">
                <span>Uploads</span>
                <strong>
                  {config?.upload_count ?? 0}
                  {config?.max_uploads ? ` / ${config.max_uploads}` : ""}
                </strong>
              </p>
            </div>

            <label className="fileRequestPublicLabel block text-[clamp(0.86rem,2vw,1rem)] font-bold">
              Submitter email
              <input
                aria-label="Submitter email"
                type="email"
                value={submitterEmail}
                onChange={(event) => setSubmitterEmail(event.target.value)}
                className="fileRequestPublicField mt-[clamp(0.45rem,1vw,0.58rem)] min-w-0 w-full rounded-[clamp(0.72rem,1.7vw,0.9rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.62rem,1.45vw,0.78rem)] text-[length:var(--settings-text-xs)] sm:text-[clamp(0.85rem,2vw,1rem)]"
              />
            </label>

            <label className="fileRequestPublicLabel block text-[clamp(0.86rem,2vw,1rem)] font-bold">
              Submitter note
              <textarea
                aria-label="Submitter note"
                value={submitterNote}
                onChange={(event) => setSubmitterNote(event.target.value)}
                rows={3}
                className="fileRequestPublicField mt-[clamp(0.45rem,1vw,0.58rem)] min-w-0 w-full resize-none rounded-[clamp(0.72rem,1.7vw,0.9rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.62rem,1.45vw,0.78rem)] text-[length:var(--settings-text-xs)] sm:text-[clamp(0.85rem,2vw,1rem)]"
              />
            </label>

            <label className="fileRequestPublicLabel block text-[clamp(0.86rem,2vw,1rem)] font-bold">
              Choose files
              <input
                aria-label="Choose files"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="fileRequestPublicField mt-[clamp(0.45rem,1vw,0.58rem)] min-w-0 w-full rounded-[clamp(0.72rem,1.7vw,0.9rem)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.48rem,1.1vw,0.62rem)] text-[length:var(--settings-text-xs)] sm:text-[clamp(0.85rem,2vw,1rem)]"
              />
            </label>
            {files.length > 0 && (
              <div className="fileRequestPublicInset rounded-[clamp(0.8rem,1.8vw,0.95rem)] p-[clamp(0.68rem,1.55vw,0.85rem)] text-[length:var(--settings-text-xs)]">
                {files.map((selected) => (
                  <p key={`${selected.name}-${selected.size}`} className="truncate">
                    {selected.name} · {formatFileSize(selected.size)}
                  </p>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={!files.length || uploading}
              className="sharePrimaryButton fileRequestPublicSubmit inline-flex w-full min-w-0 items-center justify-center whitespace-nowrap rounded-[clamp(0.82rem,2vw,1rem)] px-[clamp(0.9rem,2.2vw,1.15rem)] py-[clamp(0.68rem,1.65vw,0.88rem)] text-[length:var(--settings-text-sm)] font-bold leading-none transition-[box-shadow,filter,transform] duration-200"
            >
              {uploading ? "Uploading..." : "Submit for review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
