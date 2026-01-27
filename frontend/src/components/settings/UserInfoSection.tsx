import { memo } from 'react';

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
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">用户信息</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400">用户名</label>
          <p className="text-white">{user?.username}</p>
        </div>
        <div>
          <label className="text-sm text-gray-400">邮箱</label>
          <p className="text-white">{user?.email}</p>
        </div>
        <div>
          <label className="text-sm text-gray-400">注册时间</label>
          <p className="text-white">
            {user?.created_at
              ? new Date(user.created_at).toLocaleString('zh-CN')
              : '-'}
          </p>
        </div>
      </div>
    </div>
  );
});

export default UserInfoSection;
