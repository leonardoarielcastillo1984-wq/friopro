'use client';

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

// Loading Components
const ComponentLoader = ({ message = 'Cargando...' }: { message?: string }) => (
  <div className="flex items-center justify-center p-8 min-h-[200px]">
    <div className="flex items-center gap-3 text-gray-600">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>{message}</span>
    </div>
  </div>
);

const ErrorBoundary = ({ error }: { error: Error }) => (
  <div className="flex items-center justify-center p-8 min-h-[200px]">
    <div className="flex flex-col items-center gap-3 text-red-600">
      <AlertTriangle className="w-8 h-8" />
      <div className="text-center">
        <p className="font-medium">Error al cargar el componente</p>
        <p className="text-sm text-gray-600">{error.message}</p>
      </div>
    </div>
  </div>
);

// Lazy Loaded Components
export const LazyTrendChart = lazy(() => 
  import('./TrendChart').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyPeriodComparison = lazy(() => 
  import('./PeriodComparison').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyDrillDownChart = lazy(() => 
  import('./DrillDownChart').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazySmartAlerts = lazy(() => 
  import('./SmartAlerts').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyWorkflowAutomation = lazy(() => 
  import('./WorkflowAutomation').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyAutoEscalation = lazy(() => 
  import('./AutoEscalation').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazySmartReminders = lazy(() => 
  import('./SmartReminders').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyIntegrationManager = lazy(() => 
  import('./IntegrationManager').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyExternalAPI = lazy(() => 
  import('./ExternalAPI').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyPerformanceMonitor = lazy(() => 
  import('./PerformanceMonitor').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyMonitoringDashboard = lazy(() => 
  import('./MonitoringDashboard').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazySystemAlerts = lazy(() => 
  import('./SystemAlerts').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

// Heavy Components (Charts, Tables, etc.)
export const LazyAdvancedFilters = lazy(() => 
  import('./AdvancedFilters').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyCustomizableTable = lazy(() => 
  import('./CustomizableTable').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

export const LazyGlobalSearch = lazy(() => 
  import('./GlobalSearch').catch(error => ({ default: () => <ErrorBoundary error={error} }))
);

// Wrapper Components with Suspense
export const TrendChartLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando gráfico de tendencias..." />}>
    <LazyTrendChart {...props} />
  </Suspense>
);

export const PeriodComparisonLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando comparación de períodos..." />}>
    <LazyPeriodComparison {...props} />
  </Suspense>
);

export const DrillDownChartLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando gráfico interactivo..." />}>
    <LazyDrillDownChart {...props} />
  </Suspense>
);

export const SmartAlertsLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando alertas inteligentes..." />}>
    <LazySmartAlerts {...props} />
  </Suspense>
);

export const WorkflowAutomationLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando automatización de workflows..." />}>
    <LazyWorkflowAutomation {...props} />
  </Suspense>
);

export const AutoEscalationLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando escalamiento automático..." />}>
    <LazyAutoEscalation {...props} />
  </Suspense>
);

export const SmartRemindersLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando recordatorios inteligentes..." />}>
    <LazySmartReminders {...props} />
  </Suspense>
);

export const IntegrationManagerLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando gestor de integraciones..." />}>
    <LazyIntegrationManager {...props} />
  </Suspense>
);

export const ExternalAPILazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando API externa..." />}>
    <LazyExternalAPI {...props} />
  </Suspense>
);

export const PerformanceMonitorLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando monitor de performance..." />}>
    <LazyPerformanceMonitor {...props} />
  </Suspense>
);

export const MonitoringDashboardLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando dashboard de monitoreo..." />}>
    <LazyMonitoringDashboard {...props} />
  </Suspense>
);

export const SystemAlertsLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando alertas del sistema..." />}>
    <LazySystemAlerts {...props} />
  </Suspense>
);

export const AdvancedFiltersLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando filtros avanzados..." />}>
    <LazyAdvancedFilters {...props} />
  </Suspense>
);

export const CustomizableTableLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando tabla personalizable..." />}>
    <LazyCustomizableTable {...props} />
  </Suspense>
);

export const GlobalSearchLazy = (props: any) => (
  <Suspense fallback={<ComponentLoader message="Cargando búsqueda global..." />}>
    <LazyGlobalSearch {...props} />
  </Suspense>
);

// Intersection Observer based lazy loading for below-the-fold content
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isIntersecting;
};

// Component for intersection-based lazy loading
export const IntersectionLazy = ({ 
  children, 
  fallback = <ComponentLoader />,
  rootMargin = '100px'
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = useIntersectionObserver(ref, {
    rootMargin,
    threshold: 0.1
  });

  return (
    <div ref={ref}>
      {isIntersecting ? children : fallback}
    </div>
  );
};

// Preload critical components
export const preloadComponent = (componentName: string) => {
  switch (componentName) {
    case 'TrendChart':
      import('./TrendChart');
      break;
    case 'SmartAlerts':
      import('./SmartAlerts');
      break;
    case 'WorkflowAutomation':
      import('./WorkflowAutomation');
      break;
    case 'GlobalSearch':
      import('./GlobalSearch');
      break;
    default:
      console.warn(`Unknown component: ${componentName}`);
  }
};

// Preload multiple components
export const preloadCriticalComponents = () => {
  preloadComponent('TrendChart');
  preloadComponent('SmartAlerts');
  preloadComponent('GlobalSearch');
};

export default {
  TrendChartLazy,
  PeriodComparisonLazy,
  DrillDownChartLazy,
  SmartAlertsLazy,
  WorkflowAutomationLazy,
  AutoEscalationLazy,
  SmartRemindersLazy,
  IntegrationManagerLazy,
  ExternalAPILazy,
  PerformanceMonitorLazy,
  MonitoringDashboardLazy,
  SystemAlertsLazy,
  AdvancedFiltersLazy,
  CustomizableTableLazy,
  GlobalSearchLazy,
  IntersectionLazy,
  preloadComponent,
  preloadCriticalComponents
};
