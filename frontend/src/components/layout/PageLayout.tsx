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
  useSolidBackground?: boolean;
}

export default function PageLayout({
  children,
  title,
  backTo,
  username,
  onLogout,
  navExtra,
  showSettings,
  useSolidBackground = false,
}: PageLayoutProps) {
  return (
    <div
      className={`flex min-h-screen flex-col transition-colors duration-300 ${
        useSolidBackground
          ? "bg-[color:var(--filelist-page-bg)]"
          : "bg-[image:var(--surface-page-gradient)]"
      }`}
      data-oid="umkt5hh"
    >
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
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(1rem,2.4vw,2rem)] pt-[calc(clamp(5.5rem,10vw,8rem)+env(safe-area-inset-top))] animate-fade-in text-[var(--color-text-primary)]"
        data-oid="g430w:_"
      >
        {children}
      </main>
      <BottomBar data-oid="y9n-u0y" />
    </div>
  );
}
