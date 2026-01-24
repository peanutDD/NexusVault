import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { fileService } from '../services/files';
import { apiTokenService } from '../services/apiTokens';
import type { ApiToken } from '../services/apiTokens';
import { getErrorMessage } from '../utils/error';
import { formatBytes } from '../utils/format';
import { cn } from '../utils/cn';
import ErrorMessage from '../components/common/ErrorMessage';
import PageLayout from '../components/layout/PageLayout';

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{
    total_size: number;
    file_count: number;
    total_size_mb: number;
    quota: number | null;
    quota_mb: number | null;
    usage_percent: number | null;
    is_unlimited: boolean;
  } | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpires, setNewTokenExpires] = useState<number | ''>('');
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [showNewToken, setShowNewToken] = useState(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fileService.getStorageUsage(),
      apiTokenService.listTokens(),
    ])
      .then(([usage, tokens]) => {
        if (mounted) {
          setStorageUsage(usage);
          setApiTokens(tokens);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Settings load error:', err);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || !storageUsage?.usage_percent) return;
    const pct = `${Math.min(storageUsage.usage_percent, 100)}%`;
    el.style.setProperty('--storage-progress-pct', pct);
  }, [storageUsage?.usage_percent]);

  const loadApiTokens = useCallback(async () => {
    try {
      const tokens = await apiTokenService.listTokens();
      setApiTokens(tokens);
    } catch (err) {
      console.error('Failed to load API tokens:', err);
    }
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newTokenName.trim()) {
      setError('请输入 Token 名称');
      return;
    }

    setLoading(true);
    try {
      const response = await apiTokenService.createToken({
        name: newTokenName.trim(),
        expires_in_days: newTokenExpires ? Number(newTokenExpires) : undefined,
      });
      setNewTokenValue(response.token.token);
      setShowNewToken(true);
      setNewTokenName('');
      setNewTokenExpires('');
      await loadApiTokens();
      setSuccess('API Token 创建成功！请立即复制并保存，此 Token 只会显示一次。');
    } catch (err) {
      setError(getErrorMessage(err, '创建 API Token 失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm('确定要删除此 API Token 吗？删除后将无法恢复。')) {
      return;
    }

    setLoading(true);
    try {
      await apiTokenService.deleteToken(tokenId);
      setSuccess('API Token 已删除');
      await loadApiTokens();
    } catch (err) {
      setError(getErrorMessage(err, '删除 API Token 失败'));
    } finally {
      setLoading(false);
    }
  };

  const copyTokenToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setSuccess('Token 已复制到剪贴板');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('新密码和确认密码不匹配');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setError('新密码长度至少为 8 个字符');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setSuccess('密码修改成功');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setError(getErrorMessage(err, '密码修改失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  return (
    <PageLayout
      title="用户设置"
      backTo={{ path: '/files', label: '返回文件列表' }}
      username={user?.username}
      onLogout={handleLogout}
      showSettings={false}
    >
      <div className="max-w-4xl mx-auto">
        {error && (
          <ErrorMessage
            message={error}
            onClose={() => setError(null)}
            type="error"
          />
        )}

        {success && (
          <ErrorMessage
            message={success}
            onClose={() => setSuccess(null)}
            type="info"
          />
        )}

        <div className="space-y-6">
          {/* 用户信息 */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">用户信息</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">用户名</label>
                <p className="text-white">{user?.username}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">邮箱</label>
                <p className="text-white">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">注册时间</label>
                <p className="text-white">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleString('zh-CN')
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* 存储使用情况 */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">存储使用情况</h2>
            {storageUsage ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-gray-400">已使用存储</label>
                    {storageUsage.usage_percent !== null && (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          storageUsage.usage_percent >= 90 && 'text-red-400',
                          storageUsage.usage_percent >= 75 &&
                            storageUsage.usage_percent < 90 &&
                            'text-yellow-400',
                          storageUsage.usage_percent < 75 && 'text-green-400'
                        )}
                      >
                        {storageUsage.usage_percent}%
                      </span>
                    )}
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {formatBytes(storageUsage.total_size)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    ({storageUsage.total_size_mb} MB)
                    {storageUsage.quota_mb !== null && (
                      <span> / {storageUsage.quota_mb} MB</span>
                    )}
                  </p>
                </div>

                {storageUsage.quota !== null && storageUsage.usage_percent !== null && (
                  <div>
                    <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                      <div
                        ref={progressBarRef}
                        className={cn(
                          'storage-progress-fill h-3 rounded-full transition-all',
                          storageUsage.usage_percent >= 90 && 'bg-red-500',
                          storageUsage.usage_percent >= 75 &&
                            storageUsage.usage_percent < 90 &&
                            'bg-yellow-500',
                          storageUsage.usage_percent < 75 && 'bg-green-500'
                        )}
                      />
                    </div>
                    {storageUsage.usage_percent >= 90 && (
                      <p className="text-red-400 text-sm">
                        ⚠️ 存储配额即将用尽，请及时清理文件
                      </p>
                    )}
                    {storageUsage.usage_percent >= 75 &&
                      storageUsage.usage_percent < 90 && (
                        <p className="text-yellow-400 text-sm">
                          ⚠️ 存储使用率较高，建议清理不需要的文件
                        </p>
                      )}
                  </div>
                )}

                {storageUsage.is_unlimited && (
                  <p className="text-gray-400 text-sm">存储配额：无限制</p>
                )}

                <div>
                  <label className="text-sm text-gray-400">文件数量</label>
                  <p className="text-white">{storageUsage.file_count} 个文件</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">加载中...</p>
            )}
          </div>

          {/* 修改密码 */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">修改密码</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-300 mb-2">
                  当前密码
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      current_password: e.target.value,
                    })
                  }
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
                  新密码
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      new_password: e.target.value,
                    })
                  }
                  required
                  minLength={8}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-gray-400 text-xs mt-1">
                  密码长度至少为 8 个字符
                </p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                  确认新密码
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm_password: e.target.value,
                    })
                  }
                  required
                  minLength={8}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '修改中...' : '修改密码'}
              </button>
            </form>
          </div>

          {/* API Token 管理 */}
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">API Token 管理</h2>
            <p className="text-gray-400 text-sm mb-4">
              API Token 用于程序化访问，可以替代 JWT Token 进行身份验证。
            </p>

            {/* 创建新 Token */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-3">创建新 Token</h3>
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label htmlFor="new-token-name" className="block text-sm font-medium text-gray-300 mb-2">
                    Token 名称
                  </label>
                  <input
                    id="new-token-name"
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="例如：我的脚本、CI/CD 等"
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="new-token-expires" className="block text-sm font-medium text-gray-300 mb-2">
                    过期时间（天数，可选）
                  </label>
                  <input
                    id="new-token-expires"
                    type="number"
                    value={newTokenExpires}
                    onChange={(e) =>
                      setNewTokenExpires(e.target.value ? Number(e.target.value) : '')
                    }
                    min="1"
                    placeholder="留空表示永不过期"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '创建中...' : '创建 Token'}
                </button>
              </form>

              {/* 显示新创建的 Token */}
              {showNewToken && newTokenValue && (
                <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium mb-2">
                    ⚠️ 重要：请立即复制并保存此 Token，它只会显示一次！
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="flex-1 px-3 py-2 bg-gray-900 rounded text-yellow-300 text-sm break-all">
                      {newTokenValue}
                    </code>
                    <button
                      onClick={() => copyTokenToClipboard(newTokenValue)}
                      className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                    >
                      复制
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setShowNewToken(false);
                      setNewTokenValue(null);
                    }}
                    className="text-yellow-400 text-sm hover:text-yellow-300"
                  >
                    我已保存，关闭
                  </button>
                </div>
              )}
            </div>

            {/* Token 列表 */}
            <div>
              <h3 className="text-lg font-medium text-white mb-3">现有 Tokens</h3>
              {apiTokens.length === 0 ? (
                <p className="text-gray-400 text-sm">暂无 API Token</p>
              ) : (
                <div className="space-y-3">
                  {apiTokens.map((token) => (
                    <div
                      key={token.id}
                      className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-medium">{token.name}</h4>
                          <div className="text-gray-400 text-sm mt-1 space-y-1">
                            <p>
                              创建时间:{' '}
                              {new Date(token.created_at).toLocaleString('zh-CN')}
                            </p>
                            {token.last_used_at && (
                              <p>
                                最后使用:{' '}
                                {new Date(token.last_used_at).toLocaleString('zh-CN')}
                              </p>
                            )}
                            {token.expires_at && (
                              <p>
                                过期时间:{' '}
                                {new Date(token.expires_at).toLocaleString('zh-CN')}
                                {new Date(token.expires_at) < new Date() && (
                                  <span className="text-red-400 ml-2">(已过期)</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteToken(token.id)}
                          disabled={loading}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
