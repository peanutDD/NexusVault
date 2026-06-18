import NavBar from "./NavBar";
import BottomBar from "./BottomBar";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  backTo?: { path: string; label: string };
  username?: string | null;
  onLogout: () => void;
  navExtra?: React.ReactNode;
  showSettings?: boolean;
  hideFooter?: boolean;
  useSolidBackground?: boolean;
  backgroundClassName?: string;
  backgroundLayer?: React.ReactNode;
}

export default function PageLayout({
  children,
  title,
  backTo,
  username,
  onLogout,
  navExtra,
  showSettings,
  hideFooter = false,
  useSolidBackground = false,
  backgroundClassName,
  backgroundLayer,
}: PageLayoutProps) {
  const backgroundClass =
    backgroundClassName ??
    (useSolidBackground
      ? "[background:var(--filelist-page-bg)]"
      : "bg-[image:var(--surface-page-gradient)]");

  return (
    <div
      className={`relative isolate flex min-h-screen flex-col transition-colors duration-300 ${backgroundClass}`}
      data-testid="page-layout-shell"
      data-oid="umkt5hh"
    >
      {backgroundLayer && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          data-testid="page-background-layer"
        >
          {backgroundLayer}
        </div>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-[clamp(0.75rem,2vw,1rem)] focus:top-[clamp(0.75rem,2vw,1rem)] focus:z-[100] focus:rounded focus:[background:var(--btn-primary-bg)] focus:px-[clamp(0.625rem,1.5vw,0.75rem)] focus:py-[clamp(0.4rem,1vw,0.5rem)] focus:text-[var(--btn-primary-text)] focus:shadow-[var(--neu-control-shadow)]"
      >
        跳转到主内容
      </a>
      <NavBar
        title={title}
        backTo={backTo}
        username={username}
        onLogout={onLogout}
        extra={navExtra}
        showSettings={showSettings}
        data-oid="1zzuz8w"
      />

      <main
        id="main-content"
        className="relative z-10 mx-auto w-full max-w-[var(--app-shell-max-width)] flex-1 px-[clamp(1rem,2.5vw,2rem)] py-[clamp(1rem,2.4vw,2rem)] pt-[calc(clamp(5.5rem,10vw,8rem)+env(safe-area-inset-top))] animate-fade-in text-[var(--color-text-primary)]"
        data-testid="main-content"
        data-oid="g430w:_"
      >
        {children}
      </main>
      {!hideFooter && (
        <div className="relative z-10 flex-shrink-0" data-testid="bottom-bar-shell">
          <BottomBar data-oid="y9n-u0y" />
        </div>
      )}
    </div>
  );
}
