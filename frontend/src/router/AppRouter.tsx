import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../providers/AuthProvider";
import Spinner from "../components/common/feedback/Spinner";
import ScrollRestoration from "./ScrollRestoration";

const Login = lazy(() => import("../components/auth/Login"));
const Register = lazy(() => import("../components/auth/Register"));
const GithubCallback = lazy(() => import("../components/auth/GithubCallback"));
const Files = lazy(() => import("../pages/Files"));
const Settings = lazy(() => import("../pages/Settings"));
const Share = lazy(() => import("../pages/Share"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--app-shell-loading-bg)] text-[var(--app-shell-loading-text)]">
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
      <ScrollRestoration />
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
        <Route path="*" element={<Navigate to="/files" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
