import React, { Component, ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
          <GlassCard className="p-6 max-w-md w-full text-center">
            <AlertTriangle className="text-[#FF0033] mx-auto mb-4" size={48} />
            <h1 className="text-xl text-[#FF0033] uppercase tracking-wider mb-2">
              ERROR DETECTED
            </h1>
            <p className="text-white/60 text-sm mb-4">
              Something went wrong. Please try reloading the application.
            </p>
            {this.state.error && (
              <p className="text-white/40 text-xs mb-4 font-mono break-words">
                {this.state.error.message}
              </p>
            )}
            <Button
              onClick={this.handleReset}
              className="bg-[#FF0033] hover:bg-[#FF0033]/80 text-white uppercase tracking-wider min-h-[48px] w-full"
            >
              RELOAD APPLICATION
            </Button>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
