import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { useHydrationStore } from './store/hydrationStore';
import { useThemeStore } from './store/themeStore';
import ErrorBoundary from './components/ErrorBoundary';
import Spinner from './components/common/feedback/Spinner';
import BrowserCompatibilityWarning from './components/common/BrowserCompatibilityWarning';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401, 403, 404
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status != null && [401, 403, 404].includes(status)) return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Default to false for better UX in file util
    },
  },
});

const Login = lazy(() => import('./components/auth/Login'));
const Register = lazy(() => import('./components/auth/Register'));
const GithubCallback = lazy(() => import('./components/auth/GithubCallback'));
const Files = lazy(() => import('./pages/Files'));
const Settings = lazy(() => import('./pages/Settings'));
const Share = lazy(() => import('./pages/Share'));
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      }))
    )
  : null;

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
    <QueryClientProvider client={queryClient}>
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
              path="/auth/callback/github"
              element={
                <LazyRoute>
                  <GithubCallback />
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
            <Route path="*" element={<Navigate to="/files" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

export default App;
