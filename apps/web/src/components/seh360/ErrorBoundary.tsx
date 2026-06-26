'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary para aislar fallos de componentes pesados (ej. visualizaciones
 * cargadas dinámicamente) y evitar que tiren abajo toda la página.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SEH360 ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="text-sm font-semibold text-slate-700">
            No se pudo cargar este componente
          </p>
          <p className="text-xs text-slate-500">
            {this.state.error?.message || 'Ocurrió un error inesperado al renderizar.'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
