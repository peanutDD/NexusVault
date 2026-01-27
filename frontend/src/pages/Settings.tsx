import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { fileService } from '../services/files';
import { apiTokenService } from '../services/apiTokens';
import type { ApiToken } from '../services/apiTokens';
import { getErrorMessage } from '../utils/error';
import ErrorMessage from '../components/common/ErrorMessage';
import PageLayout from '../components/layout/PageLayout';
import {
  UserInfoSection,
  StorageUsageSection,
  PasswordChangeSection,
  ApiTokenSection,
} from '../components/settings';

interface StorageUsage {
  total_size: number;
  file_count: number;
  total_size_mb: number;
  quota: number | null;
  quota_mb: number | null;
  usage_percent: number | null;
  is_unlimited: boolean;
}

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

  // 初始化加载
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

  // Token 操作
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

  // 密码修改
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

  // 密码表单回调函数
  const handleCurrentPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }));
  }, []);

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }));
  }, []);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }));
  }, []);

  // Token 表单回调函数
  const handleTokenNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenForm((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleTokenExpiresChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenForm((prev) => ({ ...prev, expires: e.target.value ? Number(e.target.value) : '' }));
  }, []);

  const handleCloseTokenValue = useCallback(() => {
    setTokenForm((prev) => ({ ...prev, showValue: false, value: null }));
  }, []);

  // 消息关闭回调
  const handleCloseError = useCallback(() => setError(null), []);
  const handleCloseSuccess = useCallback(() => setSuccess(null), []);

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

        <div className="space-y-6">
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
    </PageLayout>
  );
}
