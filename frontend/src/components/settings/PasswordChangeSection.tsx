import { memo } from 'react';
import { KeyRound } from 'lucide-react';
import { cn } from '../../utils/cn';
import SettingsCard from './SettingsCard';

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface PasswordChangeSectionProps {
  passwordForm: PasswordForm;
  loading: boolean;
  onCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordChangeSection = memo(function PasswordChangeSection({
  passwordForm,
  loading,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordChangeSectionProps) {
  return (
    <SettingsCard
      id="security"
      title="Security"
      description="Change your password periodically and avoid reusing it across services."
      icon={<KeyRound className="h-5 w-5" aria-hidden="true" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="current-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            value={passwordForm.current_password}
            onChange={onCurrentPasswordChange}
            required
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
            htmlFor="new-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={passwordForm.new_password}
            onChange={onNewPasswordChange}
            required
            minLength={8}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
          <p className="font-brand text-slate-400 text-[length:var(--settings-text-xs)] font-normal tracking-wide mt-1">At least 8 characters</p>
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="font-brand block text-[length:var(--settings-text-sm)] font-medium tracking-wide text-slate-200 mb-2"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={passwordForm.confirm_password}
            onChange={onConfirmPasswordChange}
            required
            minLength={8}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
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
          {loading ? 'Changing...' : 'Change password'}
        </button>
      </form>
    </SettingsCard>
  );
});

export default PasswordChangeSection;
