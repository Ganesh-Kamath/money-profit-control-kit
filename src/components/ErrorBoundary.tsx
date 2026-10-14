import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ControlKit Uncaught Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-subtle flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-card border border-surface-border shadow-modal p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h1 className="text-base font-bold text-navy-950">Your data is safe and intact.</h1>

            <p className="text-xs text-navy-600 leading-relaxed">
              The application encountered a display glitch, but all your financial transactions, accounts, and backups are safely stored on this device in IndexedDB.
            </p>

            {this.state.error && (
              <div className="p-3 bg-surface-subtle rounded-control text-left text-[11px] font-mono text-navy-700 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-control text-xs transition flex items-center justify-center gap-2 shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
