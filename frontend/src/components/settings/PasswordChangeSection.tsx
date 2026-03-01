import { memo } from 'react';
import { KeyRound } from 'lucide-react';
import { cn } from '../../utils/cn';
import ErrorMessage from '../common/feedback/ErrorMessage';
import SettingsCard from './SettingsCard';

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface PasswordChangeSectionProps {
  passwordForm: PasswordForm;
  loading: boolean;
  error?: string | null;
  success?: string | null;
  onCloseError?: () => void;
  onCloseSuccess?: () => void;
  fieldErrors?: {
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  };
  onCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordChangeSection = memo(function PasswordChangeSection({
  passwordForm,
  loading,
  error,
  success,
  onCloseError,
  onCloseSuccess,
  fieldErrors,
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
            aria-invalid={Boolean(fieldErrors?.current_password)}
            aria-describedby={fieldErrors?.current_password ? 'current-password-error' : undefined}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
          {fieldErrors?.current_password && (
            <p
              id="current-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-rose-300"
            >
              {fieldErrors.current_password}
            </p>
          )}
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
            maxLength={64}
            aria-invalid={Boolean(fieldErrors?.new_password)}
            aria-describedby={fieldErrors?.new_password ? 'new-password-error' : undefined}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
          {fieldErrors?.new_password ? (
            <p
              id="new-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-rose-300"
            >
              {fieldErrors.new_password}
            </p>
          ) : (
            <p className="font-brand text-slate-400 text-[length:var(--settings-text-xs)] font-normal tracking-wide mt-1">
              8–64 characters, include at least one letter and one digit
            </p>
          )}
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
            maxLength={64}
            aria-invalid={Boolean(fieldErrors?.confirm_password)}
            aria-describedby={fieldErrors?.confirm_password ? 'confirm-password-error' : undefined}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
          {fieldErrors?.confirm_password && (
            <p
              id="confirm-password-error"
              className="font-brand mt-1 text-[length:var(--settings-text-xs)] font-normal tracking-wide text-rose-300"
            >
              {fieldErrors.confirm_password}
            </p>
          )}
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
