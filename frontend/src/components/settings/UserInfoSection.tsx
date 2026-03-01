import { memo } from 'react';
import { UserCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
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
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="profile-username"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
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
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
        </div>
        <div>
          <label
            htmlFor="profile-email"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
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
                'bg-slate-950/40 border border-emerald-300/15',
                'text-slate-100 placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
              )}
            />
            <button
              type="button"
              onClick={onSendVerificationCode}
              disabled={!canSendCode || sendingCode || sendCodeCooldown > 0 || loading}
              className={cn(
                'font-brand shrink-0 rounded-xl px-4 py-2.5 text-[length:var(--settings-text-sm)] font-semibold tracking-wide whitespace-nowrap',
                'border border-emerald-300/15 bg-emerald-500/20 text-emerald-200',
                'hover:bg-emerald-500/30 hover:border-emerald-300/25',
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
                className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
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
                  'bg-slate-950/40 border border-emerald-300/15',
                  'text-slate-100 placeholder:text-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
                )}
              />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
          <p className="font-brand text-[length:var(--settings-text-xs)] font-normal tracking-wide text-slate-400">Registered</p>
          <p className="mt-1 text-[length:var(--settings-text-sm)] font-semibold text-slate-100">
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
            'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80',
            'text-slate-950',
            'hover:from-emerald-500 hover:to-cyan-500',
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
