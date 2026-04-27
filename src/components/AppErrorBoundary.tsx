import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled app error:', error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-2 sm:px-4 py-6 sm:py-10">
        <div className="w-full max-w-xs sm:max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-8 shadow-2xl backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-200">EduHub SA</p>
          <h1 className="mt-3 text-3xl font-bold">The app hit a runtime problem.</h1>
          <p className="mt-4 text-slate-200 leading-relaxed">
            A component failed while rendering or initializing. The safest recovery is to reload the app.
            If this keeps happening, check deployment config and recent console errors.
          </p>
          {this.state.error ? (
            <pre className="mt-5 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-red-100">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Reload app
            </button>
            <a
              href="/"
              className="rounded-xl border border-white/15 px-4 py-2 font-medium text-white hover:bg-white/10"
            >
              Return home
            </a>
          </div>
        </div>
      </div>
    );
  }
}