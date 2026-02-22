import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../config/env';
import ThemeToggle from '../common/ThemeToggle';
import { cn } from '../../utils/cn';
import { ArrowLeft, LogOut, Settings } from 'lucide-react';

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
      className="fixed inset-x-0 top-0 z-50 overflow-hidden bg-slate-950/90 backdrop-blur-md"
      onDoubleClick={handleDoubleClick}
    >
      {/* 顶部紫色微光线条（对齐参考图） */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
      {/* 底部青绿色分隔线（对齐参考图） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-emerald-300/80" />
      {/* 两侧淡紫氛围光 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 via-transparent to-fuchsia-500/10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 sm:h-24">
          <div className="flex items-center gap-4 min-w-0">
            {backTo && (
              <button
                type="button"
                onClick={() => navigate(backTo.path)}
                className={cn(
                  'nav-btn inline-flex items-center justify-center rounded-md whitespace-nowrap',
                  'nav-ui-fluid font-semibold tracking-wide text-slate-200',
                  'bg-slate-900/40 border border-emerald-300/15',
                  'hover:bg-slate-900/55 hover:border-emerald-300/30',
                  'active:translate-y-px transition-all duration-200'
                )}
                aria-label={backTo.label}
                title={backTo.label}
              >
                <ArrowLeft
                  className="nav-icon shrink-0 text-emerald-200/80"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline whitespace-nowrap">{backTo.label}</span>
              </button>
            )}

            <div className="flex items-center gap-4 min-w-0">
              <div className="shrink-0 select-none">
                <CyberPrismLogo className="h-12 w-12 sm:h-14 sm:w-14" />
              </div>
              <h1 className="nav-title-fluid font-brand truncate font-normal tracking-widest text-slate-300 drop-shadow-sm select-none">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {extra}

            {/* 右侧“控制面板” */}
            <div
              className={cn(
                'nav-panel relative flex items-center rounded-lg shrink-0',
                'bg-slate-950/30 border border-emerald-300/15',
                'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_40px_rgba(0,0,0,0.35)]'
              )}
            >
              {/* 细微霓虹描边 */}
              <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400/10 via-transparent to-emerald-400/10" />

              {username != null && (
                <div
                  className={cn(
                    'nav-chip hidden sm:flex items-center rounded-md',
                    'bg-slate-900/40 border border-emerald-300/15',
                    'text-slate-300'
                  )}
                  title={username}
                >
                  <span className="nav-dot rounded-full bg-emerald-300/80 shadow-[0_0_10px_rgba(110,231,183,0.45)]" />
                  <span className="nav-ui-fluid font-brand font-semibold tracking-wider">
                    {username}
                  </span>
                </div>
              )}

              <ThemeToggle
                className={cn(
                  'nav-iconbtn p-0 rounded-md',
                  'bg-slate-900/40 border border-emerald-300/15',
                  'hover:border-emerald-300/30 hover:bg-slate-900/55',
                  'focus:ring-emerald-300/40 focus:ring-offset-slate-950'
                )}
              />

              {showSettings && (
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  aria-label="Settings"
                  className={cn(
                    'nav-btn inline-flex items-center justify-center rounded-md whitespace-nowrap',
                    'nav-ui-fluid font-semibold tracking-wide text-slate-200',
                    'bg-slate-900/40 border border-emerald-300/15',
                    'hover:bg-slate-900/55 hover:border-emerald-300/30',
                    'active:translate-y-px transition-all duration-200'
                  )}
                >
                  <Settings className="nav-icon shrink-0 text-emerald-200/80" aria-hidden="true" />
                  <span className="hidden sm:inline whitespace-nowrap">Settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                className={cn(
                  'nav-btn inline-flex items-center justify-center rounded-md whitespace-nowrap',
                  'nav-ui-fluid font-brand font-semibold tracking-wide text-slate-100',
                  'bg-slate-900/40 border border-emerald-300/15',
                  'hover:bg-slate-900/55 hover:border-rose-300/35',
                  'active:translate-y-px transition-all duration-200'
                )}
              >
                <LogOut className="nav-icon shrink-0 text-white/90" aria-hidden="true" />
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
