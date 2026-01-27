import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getErrorMessage } from '../utils/error';
import ErrorMessage from '../components/common/ErrorMessage';

export default function Share() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [fileInfo, setFileInfo] = useState<{
    id: string;
    filename: string;
    size: number;
    mime_type: string;
  } | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);

  // 回调函数优化 - 使用 useCallback 避免每次渲染创建新函数
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  const handleNavigateToLogin = useCallback(() => {
    navigate('/login');
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
          password: (p ?? '').trim() || undefined,
        });
        setFileInfo(response.data.file);
        setPasswordRequired(false);
        setError(null);
      } catch (err) {
        const errorMsg = getErrorMessage(err, '访问分享失败');
        if (errorMsg.includes('密码') || errorMsg.includes('需要密码')) {
          setPasswordRequired(true);
        } else {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
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
      window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/shares/${token}/download`;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading && !passwordRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <span
            className="w-12 h-12 border-4 border-gray-600 border-t-purple-400 rounded-full animate-spin block mx-auto mb-4"
            aria-hidden
          />
          <p className="text-gray-300">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
        <h1 className="text-2xl font-bold text-white mb-6">文件分享</h1>

        {error && (
          <ErrorMessage
            message={error}
            onClose={handleCloseError}
            type="error"
          />
        )}

        {passwordRequired ? (
          <form onSubmit={handleSubmitPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                请输入访问密码
              </label>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="分享密码"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '验证中...' : '访问文件'}
            </button>
          </form>
        ) : fileInfo ? (
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-2">
                {fileInfo.filename}
              </h2>
              <div className="text-sm text-gray-300 space-y-1">
                <p>大小: {formatFileSize(fileInfo.size)}</p>
                <p>类型: {fileInfo.mime_type}</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              下载文件
            </button>

            <button
              onClick={handleNavigateToLogin}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              返回登录
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
