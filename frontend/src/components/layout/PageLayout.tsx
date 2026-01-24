import NavBar from './NavBar';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <NavBar
        title={title}
        backTo={backTo}
        username={username}
        onLogout={onLogout}
        extra={navExtra}
        showSettings={showSettings}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
