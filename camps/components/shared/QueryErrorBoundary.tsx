'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class QueryErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.section || 'component'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-800 dark:text-red-300 font-medium mb-1">
            {this.props.section ? `Something went wrong in ${this.props.section}` : 'Something went wrong'}
          </p>
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
