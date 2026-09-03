import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/primitives';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center p-8">
          <div className="max-w-md text-center">
            <p className="text-lg font-bold text-slate-800">The screen hit an error</p>
            <p className="mt-1 text-sm text-slate-500">{this.state.error.message}</p>
            <Button className="mt-4" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
