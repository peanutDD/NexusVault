import { memo } from 'react';
import { UserCircle2 } from 'lucide-react';
import SettingsCard from './SettingsCard';

interface User {
  username?: string;
  email?: string;
  created_at?: string;
}

interface UserInfoSectionProps {
  user: User | null;
}

const UserInfoSection = memo(function UserInfoSection({ user }: UserInfoSectionProps) {
  return (
    <SettingsCard
      id="profile"
      title="账户信息"
      description="查看你的基础信息。敏感操作建议开启更强的密码策略。"
      icon={<UserCircle2 className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
          <p className="text-xs tracking-wide text-slate-400">用户名</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {user?.username ?? '-'}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
          <p className="text-xs tracking-wide text-slate-400">邮箱</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {user?.email ?? '-'}
          </p>
        </div>
        <div className="sm:col-span-2 rounded-xl border border-emerald-300/10 bg-slate-950/30 p-4">
          <p className="text-xs tracking-wide text-slate-400">注册时间</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {user?.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
          </p>
        </div>
      </div>
    </SettingsCard>
  );
});

export default UserInfoSection;
