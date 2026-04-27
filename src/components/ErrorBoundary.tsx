import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Quelque chose s'est mal passé</h2>
          <p className="text-neutral-500 mb-6 max-w-md">
            Une erreur inattendue est survenue lors du chargement de cette page. 
            L'équipe technique a été informée.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-dia-red text-white font-bold rounded-xl shadow-lg hover:bg-dia-red/90 transition-all"
          >
            Recharger l'application
          </button>
          {(process as any).env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-left text-xs overflow-auto max-w-full text-red-500">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
