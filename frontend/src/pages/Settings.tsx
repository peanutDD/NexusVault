import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { fileService } from '../services/files';
import { apiTokenService } from '../services/apiTokens';
import type { ApiToken } from '../services/apiTokens';
import type { StorageUsage } from '../types/files';
import { getErrorMessage } from '../utils/error';
import { validateEmail } from '../utils/emailValidation';
import { formatBytes } from '../utils/format';
import { useClipboard } from '../hooks/useClipboard';
import PageLayout from '../components/layout/PageLayout';
import UserInfoSection from '../components/settings/UserInfoSection';
import StorageUsageSection from '../components/settings/StorageUsageSection';
import PasswordChangeSection from '../components/settings/PasswordChangeSection';
import ApiTokenSection from '../components/settings/ApiTokenSection';
import { Settings2, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [apiTokenError, setApiTokenError] = useState<string | null>(null);
  const [apiTokenSuccess, setApiTokenSuccess] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const debugAlerts =
    typeof window !== 'undefined' &&
    Boolean(import.meta.env.DEV) &&
    new URLSearchParams(window.location.search).has('debugAlerts');
  const { copy: copyToClipboard } = useClipboard();

  const [sendingCode, setSendingCode] = useState(false);
  const [sendCodeCooldown, setSendCodeCooldown] = useState(0);

  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);
  const [showCreatedTokenValue, setShowCreatedTokenValue] = useState(false);

  const profileSchema = useMemo(() => {
    const currentEmail = user?.email ?? '';
    return z
      .object({
        username: z
          .string()
          .trim()
          .min(3, 'Username must be at least 3 characters')
          .max(50, 'Username must be at most 50 characters'),
        email: z
          .string()
          .trim()
          .superRefine((value, ctx) => {
            const r = validateEmail(value);
            if (!r.valid && r.message) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
            }
          }),
        emailVerificationCode: z.string().trim().optional(),
      })
      .superRefine((data, ctx) => {
        if (currentEmail && data.email !== currentEmail) {
          const code = (data.emailVerificationCode ?? '').trim();
          if (!code) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Email verification code is required when changing email',
              path: ['emailVerificationCode'],
            });
            return;
          }
          if (!/^\d{6}$/.test(code)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Verification code must be 6 digits',
              path: ['emailVerificationCode'],
            });
          }
        }
      });
  }, [user?.email]);

  const passwordSchema = useMemo(() => {
    return z
      .object({
        current_password: z.string().min(1, 'Current password is required'),
        new_password: z
          .string()
          .min(8, 'New password must be between 8 and 64 characters')
          .max(64, 'New password must be between 8 and 64 characters')
          .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
            message: 'New password must contain at least one letter and one digit',
          }),
        confirm_password: z.string(),
      })
      .superRefine((data, ctx) => {
        if (data.new_password !== data.confirm_password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'New password and confirmation do not match',
            path: ['confirm_password'],
          });
        }
      });
  }, []);

  const tokenSchema = useMemo(() => {
    return z.object({
      name: z.string().trim().min(1, 'Please enter a token name'),
      expires: z.union([z.literal(''), z.number().int().min(1, 'Expires must be at least 1 day')]),
    });
  }, []);

  type ProfileFormValues = z.infer<typeof profileSchema>;
  type PasswordFormValues = z.infer<typeof passwordSchema>;
  type TokenFormValues = z.infer<typeof tokenSchema>;

  const {
    watch: watchProfile,
    setValue: setProfileValue,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: '', email: '', emailVerificationCode: '' },
    mode: 'onBlur',
  });

  const {
    watch: watchPassword,
    setValue: setPasswordValue,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    setError: setPasswordFormError,
    clearErrors: clearPasswordErrors,
    formState: passwordFormState,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
    mode: 'onBlur',
  });

  const {
    watch: watchToken,
    setValue: setTokenValue,
    handleSubmit: handleTokenSubmit,
    reset: resetToken,
  } = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { name: '', expires: '' },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (debugAlerts) {
      setProfileError('(Debug) Something went wrong. This is a temporary layout check alert.');
    }
  }, [debugAlerts]);

  // Sync profile form when user changes
  useEffect(() => {
    if (user) {
      resetProfile({
        username: user.username,
        email: user.email,
        emailVerificationCode: '',
      });
    }
  }, [user, resetProfile]);

  // Send code cooldown timer
  useEffect(() => {
    if (sendCodeCooldown <= 0) return;
    const t = setInterval(() => {
      setSendCodeCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [sendCodeCooldown]);

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
  const handleCreateToken = useMemo(() => {
    return handleTokenSubmit(
      async (data) => {
        setApiTokenError(null);
        setApiTokenSuccess(null);
        setLoading(true);
        try {
          const response = await apiTokenService.createToken({
            name: data.name.trim(),
            expires_in_days: data.expires === '' ? undefined : Number(data.expires),
          });
          setCreatedTokenValue(response.token.token);
          setShowCreatedTokenValue(true);
          resetToken({ name: '', expires: '' });
          await loadApiTokens();
          setApiTokenSuccess(
            'API Token created. Copy and save it now — it will only be shown once.'
          );
        } catch (err) {
          setApiTokenError(getErrorMessage(err, 'Failed to create API Token'));
        } finally {
          setLoading(false);
        }
      },
      (errors) => {
        const message =
          errors.name?.message ??
          errors.expires?.message ??
          'Please check the form';
        setApiTokenError(String(message));
      }
    );
  }, [handleTokenSubmit, loadApiTokens, resetToken]);

  const handleDeleteToken = useCallback(async (tokenId: string) => {
    setLoading(true);
    try {
      await apiTokenService.deleteToken(tokenId);
      setApiTokenSuccess('API Token deleted');
      await loadApiTokens();
    } catch (err) {
      setApiTokenError(getErrorMessage(err, 'Failed to delete API Token'));
    } finally {
      setLoading(false);
    }
  }, [loadApiTokens]);

  const copyTokenToClipboard = useCallback(
    async (token: string) => {
      setApiTokenError(null);
      const ok = await copyToClipboard(token);
      if (!ok) {
        setApiTokenError('Copy failed. Please select the token and copy manually.');
        return;
      }
      setApiTokenSuccess('Token copied to clipboard');
    },
    [copyToClipboard]
  );

  // Send email verification code
  const handleSendVerificationCode = useCallback(async () => {
    setProfileError(null);
    setProfileSuccess(null);
    const email = (watchProfile('email') ?? '').trim();
    const emailResult = validateEmail(email);
    if (!emailResult.valid && emailResult.message) {
      setProfileError(emailResult.message);
      return;
    }
    if (user && email === user.email) {
      setProfileError('New email is the same as current email');
      return;
    }

    setSendingCode(true);
    try {
      await authService.sendEmailVerification(email);
      setProfileSuccess('Verification code sent. Check your inbox.');
      setSendCodeCooldown(60);
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Failed to send verification code'));
    } finally {
      setSendingCode(false);
    }
  }, [watchProfile, user]);

  // Profile update
  const handleUpdateProfile = useMemo(() => {
    return handleProfileSubmit(
      async (data) => {
        setProfileError(null);
        setProfileSuccess(null);

        const username = data.username.trim();
        const email = data.email.trim();

        if (user && username === user.username && email === user.email) {
          setProfileSuccess('No changes made');
          return;
        }

        setLoading(true);
        try {
          const { username_available, email_available } =
            await authService.checkProfileAvailability({
              username,
              email,
            });
          const availabilityErrors: string[] = [];
          if (!username_available) availabilityErrors.push('Username is taken');
          if (!email_available) availabilityErrors.push('Email is taken');
          if (availabilityErrors.length > 0) {
            setProfileError(availabilityErrors.join('; '));
            return;
          }

          const payload: {
            username: string;
            email: string;
            email_verification_code?: string;
          } = { username, email };
          if (user && email !== user.email && data.emailVerificationCode?.trim()) {
            payload.email_verification_code = data.emailVerificationCode.trim();
          }

          const { user: newUser } = await authService.updateProfile(payload);
          updateUser(newUser);
          setProfileSuccess('Profile updated');
          setProfileValue('emailVerificationCode', '');
        } catch (err) {
          setProfileError(getErrorMessage(err, 'Failed to update profile'));
        } finally {
          setLoading(false);
        }
      },
      (errors) => {
        const message =
          errors.username?.message ??
          errors.email?.message ??
          errors.emailVerificationCode?.message ??
          'Please check the form';
        setProfileError(String(message));
      }
    );
  }, [handleProfileSubmit, setProfileValue, updateUser, user]);

  // Password update
  const handleChangePassword = useMemo(() => {
    return handlePasswordSubmit(
      async (data) => {
        setPasswordError(null);
        setPasswordSuccess(null);
        setLoading(true);
        try {
          await authService.changePassword({
            current_password: data.current_password,
            new_password: data.new_password,
          });
          setPasswordSuccess('Password changed');
          resetPassword({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
          const message = getErrorMessage(err, 'Failed to change password');
          if (
            message.includes('between 8 and 64') ||
            message.includes('one letter and one digit') ||
            message.includes('New password must')
          ) {
            setPasswordFormError('new_password', { message });
          } else if (message.toLowerCase().includes('password') || message.includes('密码')) {
            setPasswordFormError('current_password', { message });
          } else {
            setPasswordError(message);
          }
        } finally {
          setLoading(false);
        }
      },
      () => {
        setPasswordError(null);
      }
    );
  }, [handlePasswordSubmit, resetPassword, setPasswordFormError]);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const profileValues = watchProfile();
  const passwordValues = watchPassword();
  const tokenValues = watchToken();

  // Profile form handlers
  const handleProfileUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileValue('username', e.target.value, { shouldDirty: true });
    },
    [setProfileValue]
  );

  const handleProfileEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileValue('email', e.target.value, { shouldDirty: true });
    },
    [setProfileValue]
  );

  const handleProfileEmailVerificationCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileValue(
        'emailVerificationCode',
        e.target.value.replace(/\D/g, '').slice(0, 6),
        { shouldDirty: true }
      );
    },
    [setProfileValue]
  );

  const canSendCode = (() => {
    const email = (profileValues.email ?? '').trim();
    if (!email) return false;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return false;
    if (user && email === user.email) return false;
    return true;
  })();

  // Password form handlers
  const handleCurrentPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordValue('current_password', e.target.value, { shouldDirty: true });
      clearPasswordErrors('current_password');
    },
    [clearPasswordErrors, setPasswordValue]
  );

  const handleNewPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordValue('new_password', e.target.value, { shouldDirty: true });
      clearPasswordErrors('new_password');
    },
    [clearPasswordErrors, setPasswordValue]
  );

  const handleConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordValue('confirm_password', e.target.value, { shouldDirty: true });
      clearPasswordErrors('confirm_password');
    },
    [clearPasswordErrors, setPasswordValue]
  );

  // Token form handlers
  const handleTokenNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTokenValue('name', e.target.value, { shouldDirty: true });
    },
    [setTokenValue]
  );

  const handleTokenExpiresChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTokenValue('expires', e.target.value ? Number(e.target.value) : '', { shouldDirty: true });
    },
    [setTokenValue]
  );

  const handleCloseTokenValue = useCallback(() => {
    setShowCreatedTokenValue(false);
    setCreatedTokenValue(null);
  }, []);

  // Alert close handlers
  const handleCloseProfileError = useCallback(() => setProfileError(null), []);
  const handleCloseProfileSuccess = useCallback(() => setProfileSuccess(null), []);
  const handleClosePasswordError = useCallback(() => setPasswordError(null), []);
  const handleClosePasswordSuccess = useCallback(() => setPasswordSuccess(null), []);
  const handleCloseApiTokenError = useCallback(() => setApiTokenError(null), []);
  const handleCloseApiTokenSuccess = useCallback(() => setApiTokenSuccess(null), []);

  return (
    <PageLayout
      title="SETTINGS"
      username={user?.username}
      onLogout={handleLogout}
      showSettings={false}
    >
      {/* Match NavBar width so the logo aligns with page content */}
      <div className="mx-auto max-w-7xl text-[length:var(--settings-text-md)]">
        {/* Page header (match Home neon/glass style) */}
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-300/15 bg-slate-950/30 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-emerald-400/10" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate('/files')}
                className="font-brand mb-4 inline-flex items-center rounded-xl border border-emerald-300/15 bg-slate-900/35 px-3 py-2 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-slate-200 hover:bg-slate-900/50 hover:border-emerald-300/30"
              >
                <ArrowLeft className="mr-2 h-4 w-4 shrink-0 text-emerald-200/80" aria-hidden="true" />
                Back to Home
              </button>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-emerald-300/15 bg-slate-900/40 p-2 text-emerald-200/80">
                  <Settings2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h1 className="font-brand truncate text-[length:var(--settings-text-xl)] font-normal tracking-widest text-slate-100">
                  Settings Center
                </h1>
              </div>
              <p className="font-brand mt-2 text-[length:var(--settings-text-sm)] font-normal tracking-wide text-slate-400">
                Account info, storage quota, security & token management.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-500">Files</p>
                <p className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? storageUsage.file_count : '-'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-500">Usage</p>
                <p className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-slate-100 tabular-nums">
                  {storageUsage ? formatBytes(storageUsage.total_size) : '-'}
                </p>
              </div>
              <div className="hidden sm:block rounded-xl border border-emerald-300/10 bg-slate-950/30 p-3">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-500">Tokens</p>
                <p className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-slate-100 tabular-nums">
                  {apiTokens.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column layout: quick nav on the left, content on the right */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-4">
              <div className="rounded-2xl border border-emerald-300/15 bg-slate-950/25 p-4 text-[length:var(--settings-text-sm)] text-slate-300 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-500">Quick nav</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="#profile"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Account
                  </a>
                  <a
                    href="#storage"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Storage
                  </a>
                  <a
                    href="#security"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Security
                  </a>
                  <a
                    href="#api-tokens"
                    className="font-brand rounded-xl border border-emerald-300/15 bg-slate-900/40 px-3 py-2 text-[length:var(--settings-text-xs)] font-semibold tracking-wide text-slate-200 hover:border-emerald-300/30"
                  >
                    Tokens
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-6">
            <UserInfoSection
              user={user}
              profileForm={{
                username: profileValues.username ?? '',
                email: profileValues.email ?? '',
                emailVerificationCode: profileValues.emailVerificationCode ?? '',
              }}
              loading={loading}
              error={profileError}
              success={profileSuccess}
              onCloseError={handleCloseProfileError}
              onCloseSuccess={handleCloseProfileSuccess}
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
              passwordForm={{
                current_password: passwordValues.current_password ?? '',
                new_password: passwordValues.new_password ?? '',
                confirm_password: passwordValues.confirm_password ?? '',
              }}
              loading={loading}
              error={passwordError}
              success={passwordSuccess}
              onCloseError={handleClosePasswordError}
              onCloseSuccess={handleClosePasswordSuccess}
              fieldErrors={{
                current_password: passwordFormState.errors.current_password?.message,
                new_password: passwordFormState.errors.new_password?.message,
                confirm_password: passwordFormState.errors.confirm_password?.message,
              }}
              onCurrentPasswordChange={handleCurrentPasswordChange}
              onNewPasswordChange={handleNewPasswordChange}
              onConfirmPasswordChange={handleConfirmPasswordChange}
              onSubmit={handleChangePassword}
            />

            <ApiTokenSection
              apiTokens={apiTokens}
              tokenForm={{
                name: tokenValues.name ?? '',
                expires: tokenValues.expires ?? '',
                value: createdTokenValue,
                showValue: showCreatedTokenValue,
              }}
              loading={loading}
              error={apiTokenError}
              success={apiTokenSuccess}
              onCloseError={handleCloseApiTokenError}
              onCloseSuccess={handleCloseApiTokenSuccess}
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
