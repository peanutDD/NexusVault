import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import { getErrorMessage } from "../utils/error";
import ErrorMessage from "../components/common/feedback/ErrorMessage";
import Spinner from "../components/common/feedback/Spinner";
import { apiPath } from "../config/env";

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [fileInfo, setFileInfo] = useState<{
    id: string;
    filename: string;
    size: number;
    mime_type: string;
  } | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);

  // 回调函数优化 - 使用 useCallback 避免每次渲染创建新函数
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
    },
    [],
  );

  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  const requestAccess = useCallback(
    async (p?: string) => {
      if (!token) return;
      try {
        const response = await api.post<{
          file: {
            id: string;
            filename: string;
            size: number;
            mime_type: string;
          };
          share_token: string;
        }>(`/api/shares/${token}/access`, {
          password: (p ?? "").trim() || undefined,
        });
        setFileInfo(response.data.file);
        setPasswordRequired(false);
        setError(null);
      } catch (err) {
        const errorMsg = getErrorMessage(err, "访问分享失败");
        if (errorMsg.includes("密码") || errorMsg.includes("需要密码")) {
          setPasswordRequired(true);
        } else {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) {
      requestAccess();
    }
  }, [token, requestAccess]);

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    requestAccess(password);
  };

  const handleDownload = () => {
    if (token && fileInfo) {
      window.location.href = apiPath(`/shares/${encodeURIComponent(token)}/download`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading && !passwordRequired) {
    return (
      <div
        className="min-h-screen bg-[image:var(--surface-page-gradient-dark)] flex items-center justify-center px-[clamp(0.78rem,1.8vw,1rem)]"
        data-oid="xhwx_:2"
      >
        <div className="text-center" data-oid=".t0l-fv">
          <Spinner
            size="lg"
            className="mx-auto mb-[clamp(0.78rem,1.8vw,1rem)]"
          />

          <p className="text-[var(--color-text-secondary)]" data-oid="10-_ks1">
            加载中…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[image:var(--surface-page-gradient-dark)] flex items-center justify-center p-[clamp(0.78rem,1.8vw,1rem)]"
      data-oid="pdc.az7"
    >
      <div
        className="sharePageCard [background:var(--neu-raised-bg)] border border-transparent rounded-[clamp(0.625rem,1.3vw,0.75rem)] max-w-[clamp(22rem,92vw,28rem)] w-full p-[clamp(0.78rem,1.8vw,1rem)] sm:p-[clamp(1.25rem,2.7vw,1.5rem)] shadow-[var(--neu-raised-shadow)]"
        data-oid="nucst_i"
      >
        <h1
          className="text-[clamp(1.125rem,2.8vw,1.25rem)] sm:text-[clamp(1.25rem,3.5vw,1.5rem)] font-bold text-[var(--color-text-primary)] mb-[clamp(0.78rem,1.8vw,1rem)] sm:mb-[clamp(1.25rem,2.7vw,1.5rem)]"
          data-oid="qaq0i7w"
        >
          文件分享
        </h1>

        {error && (
          <ErrorMessage
            message={error}
            onClose={handleCloseError}
            type="error"
            data-oid="rutp3p:"
          />
        )}

        {passwordRequired ? (
          <form
            onSubmit={handleSubmitPassword}
            className="space-y-[clamp(0.78rem,1.8vw,1rem)]"
            data-oid="lb0m3eh"
          >
            <div data-oid="jd650pn">
              <label
                htmlFor="share-password"
                className="block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--control-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
                data-oid="yjocs6y"
              >
                请输入访问密码
              </label>
              <input
                id="share-password"
                type="password"
                name="sharePassword"
                autoComplete="off"
                value={password}
                onChange={handlePasswordChange}
                required
                className="w-full px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] [background:var(--control-input-bg)] border border-[var(--control-input-border)] rounded-[clamp(0.5rem,1.1vw,0.625rem)] text-[var(--control-input-text)] shadow-[var(--neu-inset-shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--control-input-ring)]"
                placeholder="分享密码"
                data-oid=".8oahc6"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="sharePrimaryButton w-full px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] [background:var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-[clamp(0.5rem,1.1vw,0.625rem)] shadow-[var(--neu-control-shadow)] transition-[background,box-shadow,transform] hover:[background:var(--btn-primary-bg-hover)] active:shadow-[var(--neu-pressed-shadow)] disabled:opacity-50"
              data-oid="z:pz6.h"
            >
              {loading ? "验证中…" : "访问文件"}
            </button>
          </form>
        ) : fileInfo ? (
          <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]" data-oid="d71ad_4">
            <div
              className="shareFileInfoPanel [background:var(--neu-inset-bg)] border border-[var(--modal-surface-border)] rounded-[clamp(0.5rem,1.1vw,0.625rem)] p-[clamp(0.78rem,1.8vw,1rem)] shadow-[var(--neu-inset-shadow)]"
              data-oid="jl-jv4k"
            >
              <h2
                className="text-[clamp(0.875rem,2vw,1rem)] sm:text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[var(--color-text-primary)] mb-[clamp(0.39rem,0.9vw,0.5rem)]"
                data-oid="h3mnett"
              >
                {fileInfo.filename}
              </h2>
              <div
                className="text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--color-text-secondary)] space-y-[clamp(0.195rem,0.45vw,0.25rem)]"
                data-oid="57t_n.5"
              >
                <p data-oid="vi_.6-8">大小: {formatFileSize(fileInfo.size)}</p>
                <p data-oid="oe-ayu4">类型: {fileInfo.mime_type}</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="sharePrimaryButton w-full px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] [background:var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-[clamp(0.5rem,1.1vw,0.625rem)] shadow-[var(--neu-control-shadow)] transition-[background,box-shadow,transform] hover:[background:var(--btn-primary-bg-hover)] active:shadow-[var(--neu-pressed-shadow)]"
              data-oid="gfutdnh"
            >
              下载文件
            </button>

            <Link
              to="/login"
              className="shareSecondaryButton inline-flex w-full items-center justify-center px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] [background:var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] rounded-[clamp(0.5rem,1.1vw,0.625rem)] shadow-[var(--neu-control-shadow)] transition-[background,box-shadow,transform] hover:[background:var(--btn-secondary-bg-hover)] active:shadow-[var(--neu-pressed-shadow)]"
              data-oid=".2axd23"
            >
              返回登录
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
