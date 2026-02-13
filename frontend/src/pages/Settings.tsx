import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { fileService } from '../services/files';
import { apiTokenService } from '../services/apiTokens';
import type { ApiToken } from '../services/apiTokens';
import type { StorageUsage } from '../types/files';
import { getErrorMessage } from '../utils/error';
import { validateEmail } from '../utils/emailValidation';
import ErrorMessage from '../components/common/feedback/ErrorMessage';
import PageLayout from '../components/layout/PageLayout';
import UserInfoSection from '../components/settings/UserInfoSection';
import StorageUsageSection from '../components/settings/StorageUsageSection';
import PasswordChangeSection from '../components/settings/PasswordChangeSection';
import ApiTokenSection from '../components/settings/ApiTokenSection';
import { Settings2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    emailVerificationCode: '',
  });
  const [sendingCode, setSendingCode] = useState(false);
  const [sendCodeCooldown, setSendCodeCooldown] = useState(0);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const [tokenForm, setTokenForm] = useState({
    name: '',
    expires: '' as number | '',
    value: null as string | null,
    showValue: false,
  });

  // Sync profile form when user changes
  useEffect(() => {
    if (user) {
      setProfileForm((prev) => ({
        ...prev,
        username: user.username,
        email: user.email,
      }));
    }
  }, [user]);

  // Send code cooldown timer
  useEffect(() => {
    if (sendCodeCooldown <= 0) return;
    const t = setInterval(() => {
      setSendCodeCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sendCodeCooldown]);

  // 错误/成功提示出现时滚动到可见区域
  useEffect(() => {
    if (error || success) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error, success]);

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
      setError('Please enter a token name');
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
      setSuccess('API Token created. Copy and save it now — it will only be shown once.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create API Token'));
    } finally {
      setLoading(false);
    }
  }, [tokenForm.name, tokenForm.expires, loadApiTokens]);

  const handleDeleteToken = useCallback(async (tokenId: string) => {
    if (!confirm('Delete this API Token? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await apiTokenService.deleteToken(tokenId);
      setSuccess('API Token deleted');
      await loadApiTokens();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete API Token'));
    } finally {
      setLoading(false);
    }
  }, [loadApiTokens]);

  const copyTokenToClipboard = useCallback((token: string) => {
    navigator.clipboard.writeText(token);
    setSuccess('Token copied to clipboard');
  }, []);

  // Send email verification code
  const handleSendVerificationCode = useCallback(async () => {
    setError(null);
    const email = profileForm.email.trim();
    const emailResult = validateEmail(email);
    if (!emailResult.valid && emailResult.message) {
      setError(emailResult.message);
      return;
    }
    if (user && email === user.email) {
      setError('New email is the same as current email');
      return;
    }

    setSendingCode(true);
    try {
      await authService.sendEmailVerification(email);
      setSuccess('Verification code sent. Check your inbox.');
      setSendCodeCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send verification code'));
    } finally {
      setSendingCode(false);
    }
  }, [profileForm.email, user]);

  // Profile update
  const handleUpdateProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);

      const errors: string[] = [];
      const username = profileForm.username.trim();
      if (!username) {
        errors.push('Username is required');
      } else if (username.length < 3) {
        errors.push('Username must be at least 3 characters');
      } else if (username.length > 50) {
        errors.push('Username must be at most 50 characters');
      }
      const emailResult = validateEmail(profileForm.email);
      if (!emailResult.valid && emailResult.message) {
        errors.push(emailResult.message);
      }
      const email = profileForm.email.trim();
      if (user && email !== user.email) {
        if (!profileForm.emailVerificationCode.trim()) {
          errors.push('Email verification code is required when changing email');
        } else if (profileForm.emailVerificationCode.trim().length !== 6) {
          errors.push('Verification code must be 6 digits');
        }
      }
      if (errors.length > 0) {
        setError(errors.join('; '));
        return;
      }

      if (user && username === user.username && email === user.email) {
        setSuccess('No changes made');
        return;
      }

      setLoading(true);
      try {
        const { username_available, email_available } =
          await authService.checkProfileAvailability({
            username: username,
            email: email,
          });
        const availabilityErrors: string[] = [];
        if (!username_available) availabilityErrors.push('Username is taken');
        if (!email_available) availabilityErrors.push('Email is taken');
        if (availabilityErrors.length > 0) {
          setError(availabilityErrors.join('; '));
          setLoading(false);
          return;
        }

        const payload: {
          username: string;
          email: string;
          email_verification_code?: string;
        } = { username, email };
        if (user && email !== user.email && profileForm.emailVerificationCode.trim()) {
          payload.email_verification_code = profileForm.emailVerificationCode.trim();
        }

        const { user: newUser } = await authService.updateProfile(payload);
        updateUser(newUser);
        setSuccess('Profile updated');
        setProfileForm((p) => ({ ...p, emailVerificationCode: '' }));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to update profile'));
      } finally {
        setLoading(false);
      }
    },
    [profileForm, user, updateUser]
  );

  // Password update
  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New password and confirmation do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setSuccess('Password changed');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  }, [passwordForm]);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  // Profile form handlers
  const handleProfileUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm((prev) => ({ ...prev, username: e.target.value }));
    },
    []
  );

  const handleProfileEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm((prev) => ({ ...prev, email: e.target.value }));
    },
    []
  );

  const handleProfileEmailVerificationCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm((prev) => ({
        ...prev,
        emailVerificationCode: e.target.value.replace(/\D/g, '').slice(0, 6),
      }));
    },
    []
  );

  const canSendCode = (() => {
    const email = profileForm.email.trim();
    if (!email) return false;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return false;
    if (user && email === user.email) return false;
    return true;
  })();

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
        {/* Page header (match Home neon/glass style) */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-300/15 bg-slate-950/30 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate('/files')}
                className="font-brand mb-4 inline-flex items-center rounded-xl border border-emerald-300/15 bg-slate-900/35 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:bg-slate-900/50 hover:border-emerald-300/30"
              >
                Back to Home
              </button>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-emerald-300/15 bg-slate-900/40 p-2 text-emerald-200/80">
                  <Settings2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h1 className="font-brand truncate text-base font-normal tracking-widest text-slate-100 sm:text-lg">
                  Settings Center
                </h1>
              </div>
              <p className="font-brand mt-2 text-sm font-normal tracking-wide text-slate-400">
                Account info, storage quota, security & token management.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[11px] font-normal tracking-wide text-slate-500">Files</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? storageUsage.file_count : '-'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[11px] font-normal tracking-wide text-slate-500">Usage</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? `${storageUsage.total_size_mb} MB` : '-'}
                </p>
              </div>
              <div className="hidden sm:block rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[11px] font-normal tracking-wide text-slate-500">Tokens</p>
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
                <p className="font-brand text-xs font-normal tracking-wide text-slate-500">Quick nav</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="#profile"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Account
                  </a>
                  <a
                    href="#storage"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Storage
                  </a>
                  <a
                    href="#security"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Security
                  </a>
                  <a
                    href="#api-tokens"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Tokens
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-6">
            <div ref={errorRef}>
              {error && (
                <ErrorMessage
                  message={error}
                  onClose={handleCloseError}
                  type="error"
                  autoDismissMs={5000}
                />
              )}
              {success && (
                <ErrorMessage
                  message={success}
                  onClose={handleCloseSuccess}
                  type="info"
                  autoDismissMs={5000}
                />
              )}
            </div>
            <UserInfoSection
              user={user}
              profileForm={profileForm}
              loading={loading}
              onUsernameChange={handleProfileUsernameChange}
              onEmailChange={handleProfileEmailChange}
              onEmailVerificationCodeChange={handleProfileEmailVerificationCodeChange}
              onSendVerificationCode={handleSendVerificationCode}
              sendingCode={sendingCode}
              sendCodeCooldown={sendCodeCooldown}
              canSendCode={canSendCode}
              onSubmit={handleUpdateProfile}
            />

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
