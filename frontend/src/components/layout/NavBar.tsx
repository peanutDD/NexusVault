import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../config/env';
import { cn } from '../../utils/cn';
import { ArrowLeft, LogOut, Settings } from 'lucide-react';
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
  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 overflow-hidden bg-[var(--nav-surface-bg)] backdrop-blur-[var(--nav-surface-blur)]"
      onDoubleClick={handleDoubleClick}
    >
      {/* 顶部紫色微光线条（对齐参考图） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--nav-top-glow)]" />
      {/* 底部青绿色分隔线（对齐参考图） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-[var(--nav-bottom-line)]" />
      {/* 两侧淡紫氛围光 */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--nav-side-ambience)]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[clamp(4.75rem,7.6vw,6.25rem)]">
          <div className="flex items-center gap-4 min-w-0">
            {backTo && (
              <button
                type="button"
                onClick={() => navigate(backTo.path)}
                className={cn(
                  'nav-btn inline-flex items-center justify-center whitespace-nowrap',
                  'nav-ui-fluid font-semibold tracking-wide text-[var(--nav-btn-text)]',
                  'bg-[var(--nav-btn-bg)] border border-[var(--nav-btn-border)]',
                  'hover:bg-[var(--nav-btn-bg-hover)] hover:border-[var(--nav-btn-border-hover)]',
                  'active:translate-y-px transition-all duration-200'
                )}
                aria-label={backTo.label}
                title={backTo.label}
              >
                <ArrowLeft
                  className="nav-icon shrink-0 text-[var(--nav-btn-icon)]"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline whitespace-nowrap">{backTo.label}</span>
              </button>
            )}

            <div className="flex items-center gap-4 min-w-0">
              <div className="shrink-0 select-none">
                <CyberPrismLogo className="h-[clamp(2.6rem,4vw,3.3rem)] w-[clamp(2.6rem,4vw,3.3rem)]" />
              </div>
              <h1 className="nav-title-fluid font-brand truncate font-normal tracking-widest text-[var(--nav-title-text)] drop-shadow-sm select-none">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {extra}

            {/* 右侧“控制面板” */}
            <div
              className={cn(
                'nav-panel relative flex items-center shrink-0',
                'bg-[var(--nav-panel-bg)] border border-[var(--nav-panel-border)]',
                'shadow-[var(--nav-panel-shadow)]'
              )}
            >
              {/* 细微霓虹描边 */}
              <div className="pointer-events-none absolute inset-0 bg-[image:var(--nav-panel-edge-glow)]" />

              {username != null && (
                <div
                  className={cn(
                    'nav-chip hidden sm:flex items-center',
                    'bg-[var(--nav-chip-bg)] border border-[var(--nav-chip-border)]',
                    'text-[var(--nav-chip-text)]'
                  )}
                  title={username}
                >
                  <span className="nav-dot bg-[var(--nav-user-dot-bg)] shadow-[var(--nav-user-dot-shadow)]" />
                  <span className="nav-ui-fluid font-brand font-semibold tracking-wider">
                    {username}
                  </span>
                </div>
              )}

              {showSettings && (
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  aria-label="Settings"
                  className={cn(
                    'nav-btn inline-flex items-center justify-center whitespace-nowrap',
                    'nav-ui-fluid font-semibold tracking-wide text-[var(--nav-btn-text)]',
                    'bg-[var(--nav-btn-bg)] border border-[var(--nav-btn-border)]',
                    'hover:bg-[var(--nav-btn-bg-hover)] hover:border-[var(--nav-btn-border-hover)]',
                    'active:translate-y-px transition-all duration-200'
                  )}
                >
                  <Settings className="nav-icon shrink-0 text-[var(--nav-btn-icon)]" aria-hidden="true" />
                  <span className="hidden sm:inline whitespace-nowrap">Settings</span>
                </button>
              )}

              <ThemeToggle />

              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                className={cn(
                  'nav-btn inline-flex items-center justify-center whitespace-nowrap',
                  'nav-ui-fluid font-brand font-semibold tracking-wide text-[var(--nav-btn-text)]',
                  'bg-[var(--nav-btn-bg)] border border-[var(--nav-btn-border)]',
                  'hover:bg-[var(--nav-btn-bg-hover)] hover:border-[var(--nav-btn-border-danger-hover)]',
                  'active:translate-y-px transition-all duration-200'
                )}
              >
                <LogOut className="nav-icon shrink-0 text-[var(--nav-btn-icon-danger)]" aria-hidden="true" />
                <span className="hidden sm:inline whitespace-nowrap">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function CyberPrismLogo({ className }: { className?: string }) {
  return (
    <svg
      className={cn('drop-shadow-lg', className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Logo"
    >
      <defs>
        <linearGradient id="cp_a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#32d6c6" />
          <stop offset="1" stopColor="#46b7ff" />
        </linearGradient>
        <linearGradient id="cp_b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ff4fd8" />
        </linearGradient>
        <linearGradient id="cp_c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="cp_d" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#46b7ff" />
        </linearGradient>
        <filter id="cp_glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.6 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 外层霓虹光晕 */}
      <g filter="url(#cp_glow)" opacity="0.95">
        {/* 钻石外轮廓（对齐参考图的“钻石”形状） */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="rgba(178,139,255,0.10)"
        />

        {/* 4 个切面 */}
        <polygon points="48,10 14,40 48,48" fill="url(#cp_a)" />
        <polygon points="48,10 82,40 48,48" fill="url(#cp_b)" />
        <polygon points="14,40 48,86 48,48" fill="url(#cp_c)" />
        <polygon points="82,40 48,86 48,48" fill="url(#cp_d)" />

        {/* 高光（上半部分轻微发亮） */}
        <polygon
          points="48,14 72,39 48,32 24,39"
          fill="rgba(255,255,255,0.22)"
        />

        {/* 内部切线（更像切割钻石） */}
        <path
          d="M48 10 L48 86 M14 40 L82 40 M24 39 L48 48 L72 39"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
        />

        {/* 外描边 */}
        <polygon
          points="48,10 82,40 48,86 14,40"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
