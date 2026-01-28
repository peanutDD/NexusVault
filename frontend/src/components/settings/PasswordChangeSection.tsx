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
      title="安全"
      description="建议定期更换密码，并避免在多处复用同一密码。"
      icon={<KeyRound className="h-5 w-5" aria-hidden="true" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="current-password"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            当前密码
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
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            新密码
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
          <p className="text-slate-400 text-xs mt-1">至少 8 个字符</p>
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            确认新密码
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
            'w-full rounded-xl px-4 py-2.5 font-semibold tracking-wide',
            'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80',
            'text-slate-950',
            'hover:from-emerald-500 hover:to-cyan-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? '修改中...' : '修改密码'}
        </button>
      </form>
    </SettingsCard>
  );
});

export default PasswordChangeSection;
