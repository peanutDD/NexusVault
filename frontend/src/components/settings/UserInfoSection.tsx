import { memo } from 'react';
import { UserCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import SettingsCard from './SettingsCard';

interface ProfileForm {
  username: string;
  email: string;
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
  onSubmit: (e: React.FormEvent) => void;
}

const UserInfoSection = memo(function UserInfoSection({
  user,
  profileForm,
  loading,
  onUsernameChange,
  onEmailChange,
  onSubmit,
}: UserInfoSectionProps) {
  return (
    <SettingsCard
      id="profile"
      title="账户信息"
      description="修改你的用户名和邮箱。敏感操作建议开启更强的密码策略。"
      icon={<UserCircle2 className="h-5 w-5" aria-hidden="true" />}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="profile-username"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            用户名
          </label>
          <input
            id="profile-username"
            type="text"
            value={profileForm.username}
            onChange={onUsernameChange}
            minLength={3}
            maxLength={50}
            placeholder="3–50 个字符"
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
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            邮箱
          </label>
          <input
            id="profile-email"
            type="email"
            value={profileForm.email}
            onChange={onEmailChange}
            className={cn(
              'w-full rounded-xl px-4 py-2.5',
              'bg-slate-950/40 border border-emerald-300/15',
              'text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-300/25 focus:border-emerald-300/30'
            )}
          />
        </div>
        <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
          <p className="text-xs tracking-wide text-slate-400">注册时间</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {user?.created_at
              ? new Date(user.created_at).toLocaleString('zh-CN')
              : '-'}
          </p>
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
          {loading ? '保存中...' : '保存'}
        </button>
      </form>
    </SettingsCard>
  );
});

export default UserInfoSection;
