import {
  Component,
  lazy,
  useEffect,
  useRef,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { trackError } from "../utils/telemetry";
import { useAuthStore } from "../store/authStore";
import { clearFileListCacheSync } from "../utils/fileListCache";
import { appQueryClient } from "./queryClient";

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;

class QueryDevtoolsBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackError(error, {
      action: "react_query_devtools_error",
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function QueryDevtools() {
  if (!ReactQueryDevtools) return null;

  return (
    <QueryDevtoolsBoundary>
      <Suspense fallback={null}>
        <ReactQueryDevtools
          client={appQueryClient}
          initialIsOpen={false}
          buttonPosition="bottom-right"
          position="bottom"
          theme="dark"
        />
      </Suspense>
    </QueryDevtoolsBoundary>
  );
}

function AuthQueryScopeReset() {
  const authScope = useAuthStore((state) => state.user?.id ?? null);
  const previousAuthScope = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (previousAuthScope.current === undefined) {
      previousAuthScope.current = authScope;
      return;
    }

    if (previousAuthScope.current !== authScope) {
      appQueryClient.clear();
      clearFileListCacheSync();
      previousAuthScope.current = authScope;
    }
  }, [authScope]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={appQueryClient}>
      <AuthQueryScopeReset />
      {children}
      <QueryDevtools />
    </QueryClientProvider>
  );
}
