import NavBar from './NavBar';
import BottomBar from './BottomBar';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  backTo?: { path: string; label: string };
  username?: string | null;
  onLogout: () => void;
  navExtra?: React.ReactNode;
  showSettings?: boolean;
}

export default function PageLayout({
  children,
  title,
  backTo,
  username,
  onLogout,
  navExtra,
  showSettings,
}: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 dark:from-gray-950 dark:via-purple-950 dark:to-gray-950 transition-colors duration-300">
      <NavBar
        title={title}
        backTo={backTo}
        username={username}
        onLogout={onLogout}
        extra={navExtra}
        showSettings={showSettings}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(1rem,2.4vw,2rem)] pt-[clamp(5.5rem,10vw,8rem)] animate-fade-in">
        {children}
      </main>
      <BottomBar />
    </div>
  );
}
