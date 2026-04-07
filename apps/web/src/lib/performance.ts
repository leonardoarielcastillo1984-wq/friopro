import React from 'react';

// Mock web-vitals for now (install later)
interface Metric {
  value: number;
}

const mockWebVitals = {
  getCLS: (callback: (metric: Metric) => void) => {
    setTimeout(() => callback({ value: 0.1 }), 100);
  },
  getFID: (callback: (metric: Metric) => void) => {
    setTimeout(() => callback({ value: 50 }), 100);
  },
  getFCP: (callback: (metric: Metric) => void) => {
    setTimeout(() => callback({ value: 1200 }), 100);
  },
  getLCP: (callback: (metric: Metric) => void) => {
    setTimeout(() => callback({ value: 2000 }), 100);
  },
  getTTFB: (callback: (metric: Metric) => void) => {
    setTimeout(() => callback({ value: 300 }), 100);
  }
};

const { getCLS, getFID, getFCP, getLCP, getTTFB } = mockWebVitals;

interface PerformanceMetrics {
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  ttfb: number; // Time to First Byte
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  network: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  cpu: {
    cores: number;
    architecture: string;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    cls: 0,
    fid: 0,
    fcp: 0,
    lcp: 0,
    ttfb: 0
  };

  private observers: PerformanceObserver[] = [];
  private callbacks: ((metrics: PerformanceMetrics) => void)[] = [];

  constructor() {
    this.initWebVitals();
    this.initPerformanceObservers();
  }

  private initWebVitals() {
    // Core Web Vitals
    getCLS((metric) => {
      this.metrics.cls = metric.value;
      this.notifyCallbacks();
    });

    getFID((metric) => {
      this.metrics.fid = metric.value;
      this.notifyCallbacks();
    });

    getFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.notifyCallbacks();
    });

    getLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.notifyCallbacks();
    });

    getTTFB((metric) => {
      this.metrics.ttfb = metric.value;
      this.notifyCallbacks();
    });
  }

  private initPerformanceObservers() {
    // Observe long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.warn('Long task detected:', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Observe navigation timing
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              console.info('Navigation timing:', {
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
                firstPaint: navEntry.responseStart - navEntry.requestStart
              });
            }
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observer not supported');
      }

      // Observe resource timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              if (resourceEntry.duration > 1000) { // Log slow resources
                console.warn('Slow resource:', {
                  name: resourceEntry.name,
                  duration: resourceEntry.duration,
                  size: resourceEntry.transferSize
                });
              }
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    }
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.metrics));
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getSystemMetrics(): SystemMetrics {
    const memory = (performance as any).memory || {};
    const connection = (navigator as any).connection || {};
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;

    return {
      memory: {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        limit: memory.jsHeapSizeLimit || 0
      },
      network: {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0
      },
      cpu: {
        cores: hardwareConcurrency,
        architecture: 'unknown' // Not available in browsers
      }
    };
  }

  public onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  public measurePageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
  }

  public measureRenderTime(name: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    const duration = end - start;
    
    console.info(`Render time for ${name}:`, duration);
    return duration;
  }

  public trackUserInteraction(element: string, action: string) {
    const mark = `${element}-${action}-${Date.now()}`;
    performance.mark(mark);
    
    // Measure time to next interaction or page load
    setTimeout(() => {
      try {
        performance.measure(
          `${element} ${action} to next interaction`,
          mark,
          `${element}-${action}-end`
        );
      } catch (e) {
        // Ignore measurement errors
      }
    }, 100);
  }

  public generateReport(): string {
    const metrics = this.getMetrics();
    const systemMetrics = this.getSystemMetrics();
    
    return `
Performance Report - ${new Date().toISOString()}
======================================
Core Web Vitals:
- CLS (Cumulative Layout Shift): ${metrics.cls.toFixed(3)}
- FID (First Input Delay): ${metrics.fid.toFixed(0)}ms
- FCP (First Contentful Paint): ${metrics.fcp.toFixed(0)}ms
- LCP (Largest Contentful Paint): ${metrics.lcp.toFixed(0)}ms
- TTFB (Time to First Byte): ${metrics.ttfb.toFixed(0)}ms

System Metrics:
- Memory Used: ${(systemMetrics.memory.used / 1024 / 1024).toFixed(2)}MB
- Memory Total: ${(systemMetrics.memory.total / 1024 / 1024).toFixed(2)}MB
- Network Type: ${systemMetrics.network.effectiveType}
- CPU Cores: ${systemMetrics.cpu.cores}

Performance Scores:
- CLS: ${metrics.cls < 0.1 ? 'Good' : metrics.cls < 0.25 ? 'Needs Improvement' : 'Poor'}
- FID: ${metrics.fid < 100 ? 'Good' : metrics.fid < 300 ? 'Needs Improvement' : 'Poor'}
- FCP: ${metrics.fcp < 1800 ? 'Good' : metrics.fcp < 3000 ? 'Needs Improvement' : 'Poor'}
- LCP: ${metrics.lcp < 2500 ? 'Good' : metrics.lcp < 4000 ? 'Needs Improvement' : 'Poor'}
    `;
  }

  public disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.callbacks = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React Hook for performance monitoring
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics>(performanceMonitor.getMetrics());
  const [systemMetrics, setSystemMetrics] = React.useState<SystemMetrics>(performanceMonitor.getSystemMetrics());

  React.useEffect(() => {
    const unsubscribe = performanceMonitor.onMetricsUpdate(setMetrics);
    
    // Update system metrics periodically
    const interval = setInterval(() => {
      setSystemMetrics(performanceMonitor.getSystemMetrics());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    metrics,
    systemMetrics,
    report: performanceMonitor.generateReport(),
    trackInteraction: performanceMonitor.trackUserInteraction.bind(performanceMonitor)
  };
}
