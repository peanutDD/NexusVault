import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../config/env';

interface NavBarProps {
  title?: string;
  backTo?: { path: string; label: string };
  username?: string | null;
  onLogout: () => void;
  extra?: React.ReactNode;
  showSettings?: boolean;
}

export default function NavBar({
  title = APP_NAME,
  backTo,
  username,
  onLogout,
  extra,
  showSettings = true,
}: NavBarProps) {
  const navigate = useNavigate();

  return (
    <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            {backTo && (
              <button
                type="button"
                onClick={() => navigate(backTo.path)}
                className="text-gray-300 hover:text-white"
              >
                ← {backTo.label}
              </button>
            )}
            <h1 className="text-xl font-bold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {username != null && (
              <span className="text-gray-300">欢迎, {username}</span>
            )}
            {extra}
            {showSettings && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                设置
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
