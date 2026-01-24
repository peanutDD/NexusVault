import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../config/env';
import ThemeToggle from '../common/ThemeToggle';

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
    <nav className="bg-white/10 dark:bg-gray-900/80 backdrop-blur-lg border-b border-white/20 dark:border-gray-700/50 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            {backTo && (
              <button
                type="button"
                onClick={() => navigate(backTo.path)}
                className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors duration-200"
              >
                ← {backTo.label}
              </button>
            )}
            <h1 className="text-xl font-bold text-white dark:text-gray-100 transition-colors duration-200">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {username != null && (
              <span className="text-gray-300 dark:text-gray-400 text-sm sm:text-base transition-colors duration-200">
                欢迎, {username}
              </span>
            )}
            {extra}
            <ThemeToggle />
            {showSettings && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="px-3 sm:px-4 py-2 bg-gray-700 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-500 transition-all duration-200 text-sm sm:text-base"
              >
                设置
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="px-3 sm:px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-200 text-sm sm:text-base"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
