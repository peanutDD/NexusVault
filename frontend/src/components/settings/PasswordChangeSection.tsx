import { memo } from 'react';

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
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">修改密码</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="current-password" className="block text-sm font-medium text-gray-300 mb-2">
            当前密码
          </label>
          <input
            id="current-password"
            type="password"
            value={passwordForm.current_password}
            onChange={onCurrentPasswordChange}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
            新密码
          </label>
          <input
            id="new-password"
            type="password"
            value={passwordForm.new_password}
            onChange={onNewPasswordChange}
            required
            minLength={8}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-gray-400 text-xs mt-1">
            密码长度至少为 8 个字符
          </p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
            确认新密码
          </label>
          <input
            id="confirm-password"
            type="password"
            value={passwordForm.confirm_password}
            onChange={onConfirmPasswordChange}
            required
            minLength={8}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '修改中...' : '修改密码'}
        </button>
      </form>
    </div>
  );
});

export default PasswordChangeSection;
