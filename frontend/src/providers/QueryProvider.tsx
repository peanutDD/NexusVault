import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trackError } from "../utils/telemetry";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error: unknown) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status != null && [401, 403, 404].includes(status)) return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
});

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
          client={queryClient}
          initialIsOpen={false}
          buttonPosition="bottom-right"
          position="bottom"
          theme="dark"
        />
      </Suspense>
    </QueryDevtoolsBoundary>
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <QueryDevtools />
    </QueryClientProvider>
  );
}
