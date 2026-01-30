import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useHydrationStore } from './store/hydrationStore';
import { useThemeStore } from './store/themeStore';
import ErrorBoundary from './components/ErrorBoundary';
import Spinner from './components/common/Spinner';
import BrowserCompatibilityWarning from './components/common/BrowserCompatibilityWarning';

const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const Files = lazy(() => import('./pages/Files'));
const Settings = lazy(() => import('./pages/Settings'));
const Share = lazy(() => import('./pages/Share'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrationStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-900 text-gray-400">
        <Spinner size="lg" />
        <span>Loading...</span>
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-900 text-gray-400">
          <Spinner size="lg" />
          <span>Loading...</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function App() {
  const { effectiveTheme } = useThemeStore();

  // 初始化主题应用到 DOM
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  return (
    <>
      <BrowserCompatibilityWarning />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <LazyRoute>
                  <Login />
                </LazyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <LazyRoute>
                  <Register />
                </LazyRoute>
              }
            />
            <Route
              path="/share/:token"
              element={
                <LazyRoute>
                  <Share />
                </LazyRoute>
              }
            />
            <Route
              path="/files"
              element={
                <PrivateRoute>
                  <LazyRoute>
                    <Files />
                  </LazyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <LazyRoute>
                    <Settings />
                  </LazyRoute>
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/files" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </>
  );
}

export default App;
