import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../providers/AuthProvider";
import Spinner from "../components/common/feedback/Spinner";

const Login = lazy(() => import("../components/auth/Login"));
const Register = lazy(() => import("../components/auth/Register"));
const GithubCallback = lazy(() => import("../components/auth/GithubCallback"));
const Files = lazy(() => import("../pages/Files"));
const Settings = lazy(() => import("../pages/Settings"));
const Activity = lazy(() => import("../pages/Activity"));
const Share = lazy(() => import("../pages/Share"));
const Shares = lazy(() => import("../pages/Shares"));
const FileRequest = lazy(() => import("../pages/FileRequest"));
const Trash = lazy(() => import("../pages/Trash"));

function RouteFallback() {
  return (
    <div className="neu-flat min-h-screen flex flex-col items-center justify-center gap-[clamp(0.5rem,1.5vw,0.75rem)] text-[var(--app-shell-loading-text)]">
      <Spinner size="lg" />
      <span>Loading...</span>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export default function AppRouter() {
  return (
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
          path="/request/:token"
          element={
            <LazyRoute>
              <FileRequest />
            </LazyRoute>
          }
        />
        <Route
          path="/files"
          element={
            <RequireAuth>
              <LazyRoute>
                <Files />
              </LazyRoute>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <LazyRoute>
                <Settings />
              </LazyRoute>
            </RequireAuth>
          }
        />
        <Route
          path="/activity"
          element={
            <RequireAuth>
              <LazyRoute>
                <Activity />
              </LazyRoute>
            </RequireAuth>
          }
        />
        <Route
          path="/shares"
          element={
            <RequireAuth>
              <LazyRoute>
                <Shares />
              </LazyRoute>
            </RequireAuth>
          }
        />
        <Route
          path="/trash"
          element={
            <RequireAuth>
              <LazyRoute>
                <Trash />
              </LazyRoute>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/files" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
