import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('voxel_history'); // Clear potentially corrupt data
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                <AlertTriangle size={40} className="text-red-500" />
            </div>
            <div className="space-y-2">
                <h1 className="text-3xl font-black uppercase tracking-tighter">System Malfunction</h1>
                <p className="text-gray-400 font-medium">
                    The engine encountered a critical sequence error. This usually happens when the browser storage is full.
                </p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded font-mono text-xs text-red-400 text-left overflow-auto max-h-40 w-full">
                {this.state.error?.message || 'Unknown Execution Error'}
            </div>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-8 py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
            >
              <RefreshCcw size={18} /> Reinitialize Engine
            </button>
            <p className="text-[10px] text-gray-600 uppercase">Warning: Reinitialization will clear your local history</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
