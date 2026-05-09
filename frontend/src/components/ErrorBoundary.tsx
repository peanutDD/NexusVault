import { type ReactNode, type ErrorInfo, Component } from "react";
import { trackError } from "../utils/telemetry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackError(error, {
      action: "react_error_boundary",
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center bg-[var(--error-boundary-bg)] text-[var(--error-boundary-text)] p-[clamp(1.25rem,4vw,2rem)]"
          data-oid="p_vs_.v"
        >
          <h1
            className="mb-[clamp(0.4rem,1vw,0.5rem)] text-[clamp(1.05rem,2.4vw,1.25rem)] font-semibold text-[var(--error-boundary-title)]"
            data-oid="y6lgxjp"
          >
            出错了
          </h1>
          <p
            className="mb-[clamp(0.75rem,2vw,1rem)] max-w-[28rem] text-center text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--error-boundary-muted)]"
            data-oid="oez77o8"
          >
            {this.state.error?.message ?? "未知错误"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--error-boundary-action-bg)] px-[clamp(0.75rem,2vw,1rem)] py-[clamp(0.4rem,1vw,0.5rem)] text-[var(--error-boundary-action-text)] hover:bg-[var(--error-boundary-action-bg-hover)]"
            data-oid="wu:q3m1"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
