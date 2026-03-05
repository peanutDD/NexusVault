import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getErrorMessage } from "../utils/error";
import ErrorMessage from "../components/common/feedback/ErrorMessage";

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
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

  const handleNavigateToLogin = useCallback(() => {
    navigate("/login");
  }, [navigate]);

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
      window.location.href = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/api/shares/${token}/download`;
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
        className="min-h-screen bg-[image:var(--surface-page-gradient-dark)] flex items-center justify-center px-4"
        data-oid="xhwx_:2"
      >
        <div className="text-center" data-oid=".t0l-fv">
          <span
            className="w-12 h-12 border-4 border-[rgba(var(--rgb-white),0.18)] border-t-[rgba(var(--rgb-malachite-500),0.7)] rounded-full animate-spin block mx-auto mb-4"
            aria-hidden
            data-oid="ajp3jzd"
          />

          <p className="text-[var(--color-text-secondary)]" data-oid="10-_ks1">
            加载中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[image:var(--surface-page-gradient-dark)] flex items-center justify-center p-4"
      data-oid="pdc.az7"
    >
      <div
        className="bg-[var(--modal-surface-bg)] border border-[var(--modal-surface-border)] rounded-lg max-w-md w-full p-4 sm:p-6 shadow-[var(--shadow-glass-md)]"
        data-oid="nucst_i"
      >
        <h1
          className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6"
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
            className="space-y-4"
            data-oid="lb0m3eh"
          >
            <div data-oid="jd650pn">
              <label
                className="block text-sm font-medium text-[var(--control-label-text)] mb-2"
                data-oid="yjocs6y"
              >
                请输入访问密码
              </label>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                required
                className="w-full px-4 py-2 bg-[var(--control-input-bg)] border border-[var(--control-input-border)] rounded-lg text-[var(--control-input-text)] focus:outline-none focus:ring-2 focus:ring-[var(--control-input-ring)]"
                placeholder="分享密码"
                data-oid=".8oahc6"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-lg hover:bg-[var(--btn-primary-bg-hover)] disabled:opacity-50"
              data-oid="z:pz6.h"
            >
              {loading ? "验证中..." : "访问文件"}
            </button>
          </form>
        ) : fileInfo ? (
          <div className="space-y-4" data-oid="d71ad_4">
            <div
              className="bg-[rgba(var(--rgb-white),0.06)] border border-[var(--color-border-soft)] rounded-lg p-4"
              data-oid="jl-jv4k"
            >
              <h2
                className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-2"
                data-oid="h3mnett"
              >
                {fileInfo.filename}
              </h2>
              <div
                className="text-sm text-[var(--color-text-secondary)] space-y-1"
                data-oid="57t_n.5"
              >
                <p data-oid="vi_.6-8">大小: {formatFileSize(fileInfo.size)}</p>
                <p data-oid="oe-ayu4">类型: {fileInfo.mime_type}</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full px-4 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-lg hover:bg-[var(--btn-primary-bg-hover)]"
              data-oid="gfutdnh"
            >
              下载文件
            </button>

            <button
              onClick={handleNavigateToLogin}
              className="w-full px-4 py-2 bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] rounded-lg hover:bg-[var(--btn-secondary-bg-hover)]"
              data-oid=".2axd23"
            >
              返回登录
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
