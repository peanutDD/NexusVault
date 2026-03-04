import { memo } from 'react';
import { UserCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import ErrorMessage from '../common/feedback/ErrorMessage';
import SettingsCard from './SettingsCard';

interface ProfileForm {
  username: string;
  email: string;
  emailVerificationCode: string;
}

interface User {
  username?: string;
  email?: string;
  created_at?: string;
}

interface UserInfoSectionProps {
  user: User | null;
  profileForm: ProfileForm;
  loading: boolean;
  error?: string | null;
  success?: string | null;
  onCloseError?: () => void;
  onCloseSuccess?: () => void;
  onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailVerificationCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendVerificationCode: () => void;
  sendingCode: boolean;
  sendCodeCooldown: number;
  canSendCode: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const UserInfoSection = memo(function UserInfoSection({
  user,
  profileForm,
  loading,
  error,
  success,
  onCloseError,
  onCloseSuccess,
  onUsernameChange,
  onEmailChange,
  onEmailVerificationCodeChange,
  onSendVerificationCode,
  sendingCode,
  sendCodeCooldown,
  canSendCode,
  onSubmit,
}: UserInfoSectionProps) {
  return (
    <SettingsCard
      id="profile"
      title="Account"
      description="Update your username and email. Email changes require verification."
      icon={<UserCircle2 className="h-5 w-5" aria-hidden="true" />}
    >
      {error && (
        <ErrorMessage
          message={error}
          onClose={onCloseError}
          type="error"
          autoDismissMs={5000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
        />
      )}
      {success && (
        <ErrorMessage
          message={success}
          onClose={onCloseSuccess}
          type="info"
          autoDismissMs={3000}
          className="mb-4 [&_p]:text-[length:var(--settings-text-sm)]"
        />
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="profile-username"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
          >
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            value={profileForm.username}
            onChange={onUsernameChange}
            minLength={3}
            maxLength={50}
            placeholder="3–50 characters"
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]',
              'text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]'
            )}
          />
        </div>
        <div>
          <label
            htmlFor="profile-email"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
          >
            Email
          </label>
          <div className="flex gap-2">
            <input
              id="profile-email"
              type="email"
              value={profileForm.email}
              onChange={onEmailChange}
              className={cn(
                'flex-1 rounded-xl px-4 py-2.5',
                'bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]',
                'text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]'
              )}
            />
            <button
              type="button"
              onClick={onSendVerificationCode}
              disabled={!canSendCode || sendingCode || sendCodeCooldown > 0 || loading}
              className={cn(
                'font-brand shrink-0 rounded-xl px-4 py-2.5 text-[length:var(--settings-text-sm)] font-semibold tracking-wide whitespace-nowrap',
                'border border-[var(--settings-secondary-border)] bg-[var(--settings-secondary-bg)] text-[var(--settings-secondary-text)]',
                'hover:bg-[var(--settings-secondary-bg-hover)] hover:border-[var(--settings-secondary-border-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {sendCodeCooldown > 0
                ? `${sendCodeCooldown}s`
                : sendingCode
                  ? 'Sending...'
                  : 'Get code'}
            </button>
          </div>
          {user?.email && profileForm.email.trim() !== user.email && (
            <div className="mt-2">
              <label
                htmlFor="profile-email-code"
                className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-[var(--settings-form-label)] mb-2"
              >
                Verification code
              </label>
              <input
                id="profile-email-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={profileForm.emailVerificationCode}
                onChange={onEmailVerificationCodeChange}
                placeholder="6 digits"
                maxLength={6}
                className={cn(
                  'w-full rounded-xl px-4 py-2.5',
                  'bg-[var(--settings-form-input-bg)] border border-[var(--settings-form-input-border)]',
                  'text-[var(--settings-form-input-text)] placeholder:text-[var(--settings-form-placeholder)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--settings-form-input-ring)] focus:border-[var(--settings-form-input-border-focus)]'
                )}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[var(--settings-panel-border)] bg-[var(--settings-panel-bg)] p-4">
          <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-[var(--settings-panel-label)]">Registered</p>
          <p className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-[var(--settings-panel-value)]">
            {user?.created_at
              ? new Date(user.created_at).toLocaleString()
              : '-'}
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'font-brand w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide',
            'bg-[var(--settings-action-bg)] text-[var(--settings-action-text)]',
            'hover:bg-[var(--settings-action-bg-hover)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </SettingsCard>
  );
});

export default UserInfoSection;
