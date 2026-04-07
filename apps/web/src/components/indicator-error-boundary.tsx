'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class IndicatorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Indicator Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Error al cargar el indicador</h3>
            <p className="text-red-600 text-sm mb-4">
              Ocurrió un error inesperado al cargar los detalles del indicador. Por favor, intenta recargar la página.
            </p>
            <div className="space-x-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Recargar página
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50"
              >
                Volver
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="text-xs text-red-500 cursor-pointer">Detalles del error</summary>
                <pre className="mt-2 text-xs text-red-400 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default IndicatorErrorBoundary;
