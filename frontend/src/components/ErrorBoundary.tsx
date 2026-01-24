import { type ReactNode, Component } from 'react';

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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-300 p-8">
          <h1 className="text-xl font-semibold text-white mb-2">
            出错了
          </h1>
          <p className="text-sm text-gray-400 mb-4 max-w-md text-center">
            {this.state.error?.message ?? '未知错误'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
