import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Spinner from "../components/common/feedback/Spinner";
import { useAuthStore } from "../store/authStore";
import { useHydrationStore } from "../store/hydrationStore";

type AuthContextValue = {
  hydrated: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-[clamp(0.5rem,1.5vw,0.75rem)] bg-[var(--app-shell-loading-bg)] text-[var(--app-shell-loading-text)]">
      <Spinner size="lg" />
      <span>Loading...</span>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrationStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) =>
    Boolean(state.token && state.user),
  );

  const value = useMemo(
    () => ({ hydrated, isAuthenticated }),
    [hydrated, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthState() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthState must be used within AuthProvider");
  }

  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { hydrated, isAuthenticated } = useAuthState();

  if (!hydrated) {
    return <AuthLoadingScreen />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
