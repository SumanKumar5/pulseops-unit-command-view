import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(
      `[ErrorBoundary:${this.props.name ?? "unknown"}]`,
      error,
      info,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center">
            <div className="text-2xl">⚠</div>
            <p className="text-sm font-semibold text-red-400">
              {this.props.name ?? "Component"} failed to render
            </p>
            <p className="text-xs text-slate-500 max-w-xs">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
