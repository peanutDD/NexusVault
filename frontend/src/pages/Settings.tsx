import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { fileService } from '../services/files';
import { apiTokenService } from '../services/apiTokens';
import type { ApiToken } from '../services/apiTokens';
import type { StorageUsage } from '../types';
import { getErrorMessage } from '../utils/error';
import ErrorMessage from '../components/common/ErrorMessage';
import PageLayout from '../components/layout/PageLayout';
import {
  UserInfoSection,
  StorageUsageSection,
  PasswordChangeSection,
  ApiTokenSection,
} from '../components/settings';
import { Settings2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [tokenForm, setTokenForm] = useState({
    name: '',
    expires: '' as number | '',
    value: null as string | null,
    showValue: false,
  });

  // Initial load
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

  const loadApiTokens = useCallback(async () => {
    try {
      const tokens = await apiTokenService.listTokens();
      setApiTokens(tokens);
    } catch (err) {
      console.error('Failed to load API tokens:', err);
    }
  }, []);

  // Token actions
  const handleCreateToken = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!tokenForm.name.trim()) {
      setError('请输入 Token 名称');
      return;
    }

    setLoading(true);
    try {
      const response = await apiTokenService.createToken({
        name: tokenForm.name.trim(),
        expires_in_days: tokenForm.expires ? Number(tokenForm.expires) : undefined,
      });
      setTokenForm((prev) => ({
        ...prev,
        value: response.token.token,
        showValue: true,
        name: '',
        expires: '',
      }));
      await loadApiTokens();
      setSuccess('API Token 创建成功！请立即复制并保存，此 Token 只会显示一次。');
    } catch (err) {
      setError(getErrorMessage(err, '创建 API Token 失败'));
    } finally {
      setLoading(false);
    }
  }, [tokenForm.name, tokenForm.expires, loadApiTokens]);

  const handleDeleteToken = useCallback(async (tokenId: string) => {
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
  }, [loadApiTokens]);

  const copyTokenToClipboard = useCallback((token: string) => {
    navigator.clipboard.writeText(token);
    setSuccess('Token 已复制到剪贴板');
  }, []);

  // Password update
  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
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
  }, [passwordForm]);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  // Password form handlers
  const handleCurrentPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }));
  }, []);

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }));
  }, []);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }));
  }, []);

  // Token form handlers
  const handleTokenNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenForm((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleTokenExpiresChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenForm((prev) => ({ ...prev, expires: e.target.value ? Number(e.target.value) : '' }));
  }, []);

  const handleCloseTokenValue = useCallback(() => {
    setTokenForm((prev) => ({ ...prev, showValue: false, value: null }));
  }, []);

  // Alert close handlers
  const handleCloseError = useCallback(() => setError(null), []);
  const handleCloseSuccess = useCallback(() => setSuccess(null), []);

  return (
    <PageLayout
      title="SETTINGS"
      username={user?.username}
      onLogout={handleLogout}
      showSettings={false}
    >
      {/* Match NavBar width so the logo aligns with page content */}
      <div className="mx-auto max-w-7xl">
        {error && (
          <ErrorMessage
            message={error}
            onClose={handleCloseError}
            type="error"
          />
        )}

        {success && (
          <ErrorMessage
            message={success}
            onClose={handleCloseSuccess}
            type="info"
          />
        )}

        {/* Page header (match Home neon/glass style) */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-300/15 bg-slate-950/30 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate('/files')}
                className="mb-4 inline-flex items-center rounded-xl border border-emerald-300/15 bg-slate-900/35 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:bg-slate-900/50 hover:border-emerald-300/30"
              >
                返回主页
              </button>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-emerald-300/15 bg-slate-900/40 p-2 text-emerald-200/80">
                  <Settings2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h1 className="truncate text-base font-semibold tracking-wide text-slate-100 sm:text-lg">
                  设置中心
                </h1>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                账户信息、存储配额、安全与 Token 管理。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="text-[11px] tracking-wide text-slate-500">文件</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? storageUsage.file_count : '-'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="text-[11px] tracking-wide text-slate-500">用量</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? `${storageUsage.total_size_mb} MB` : '-'}
                </p>
              </div>
              <div className="hidden sm:block rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="text-[11px] tracking-wide text-slate-500">Tokens</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 tabular-nums">
                  {apiTokens.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout: quick nav on the left, content on the right */}
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-4">
              <div className="rounded-2xl border border-emerald-300/15 bg-slate-950/25 p-4 text-sm text-slate-300 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <p className="text-xs tracking-wide text-slate-500">快速导航</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="#profile"
                    className="rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-300/30"
                  >
                    账户
                  </a>
                  <a
                    href="#storage"
                    className="rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-300/30"
                  >
                    存储
                  </a>
                  <a
                    href="#security"
                    className="rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-300/30"
                  >
                    安全
                  </a>
                  <a
                    href="#api-tokens"
                    className="rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-300/30"
                  >
                    Tokens
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-6">
            <UserInfoSection user={user} />

            <StorageUsageSection storageUsage={storageUsage} />

            <PasswordChangeSection
              passwordForm={passwordForm}
              loading={loading}
              onCurrentPasswordChange={handleCurrentPasswordChange}
              onNewPasswordChange={handleNewPasswordChange}
              onConfirmPasswordChange={handleConfirmPasswordChange}
              onSubmit={handleChangePassword}
            />

            <ApiTokenSection
              apiTokens={apiTokens}
              tokenForm={tokenForm}
              loading={loading}
              onTokenNameChange={handleTokenNameChange}
              onTokenExpiresChange={handleTokenExpiresChange}
              onCreateToken={handleCreateToken}
              onDeleteToken={handleDeleteToken}
              onCopyToken={copyTokenToClipboard}
              onCloseTokenValue={handleCloseTokenValue}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
