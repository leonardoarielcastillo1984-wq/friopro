import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import SmartAlerts from '../SmartAlerts';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Bell: () => <div data-testid="bell-icon" />,
  BellRing: () => <div data-testid="bell-ring-icon" />,
  CheckCircle2: () => <div data-testid="check-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  Info: () => <div data-testid="info-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronUp: () => <div data-testid="chevron-up-icon" />,
  X: () => <div data-testid="x-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />
}));

describe('SmartAlerts Component', () => {
  const mockAlerts = [
    {
      id: '1',
      ruleId: 'ncr-high',
      ruleName: 'NCRs Críticas Abiertas',
      message: 'Hay 2 NCRs de severidad crítica abiertas por más de 7 días',
      severity: 'high' as const,
      metric: 'NCRs',
      currentValue: 2,
      threshold: 1,
      category: 'quality' as const,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      actionRequired: true,
      suggestedActions: ['Revisar asignación de recursos', 'Priorizar acciones correctivas']
    },
    {
      id: '2',
      ruleId: 'indicator-below',
      ruleName: 'Indicador por debajo del objetivo',
      message: 'El indicador de satisfacción del cliente está 5% por debajo del objetivo',
      severity: 'medium' as const,
      metric: 'Satisfacción Cliente',
      currentValue: 85,
      threshold: 90,
      category: 'customer' as const,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      actionRequired: true,
      suggestedActions: ['Analizar causas raíz', 'Implementar plan de mejora']
    },
    {
      id: '3',
      ruleId: 'risk-escalated',
      ruleName: 'Riesgo Escalado',
      message: 'Riesgo de seguridad ha sido escalado a nivel gerencial',
      severity: 'critical' as const,
      metric: 'Riesgos',
      currentValue: 8,
      threshold: 5,
      category: 'risk' as const,
      timestamp: new Date().toISOString(),
      acknowledged: true,
      resolved: false,
      actionRequired: true,
      suggestedActions: ['Reunión de comité', 'Plan de mitigación inmediato']
    }
  ];

  const mockRules = [
    {
      id: 'ncr-high',
      name: 'NCRs Críticas Abiertas',
      description: 'Alerta cuando hay NCRs críticas abiertas por más de 7 días',
      type: 'threshold' as const,
      metric: 'NCRs',
      condition: 'above' as const,
      threshold: 1,
      severity: 'high' as const,
      enabled: true,
      category: 'quality' as const
    },
    {
      id: 'indicator-below',
      name: 'Indicador por debajo del objetivo',
      description: 'Alerta cuando un indicador está por debajo del objetivo',
      type: 'threshold' as const,
      metric: 'Indicadores',
      condition: 'below' as const,
      threshold: 90,
      severity: 'medium' as const,
      enabled: true,
      category: 'customer' as const
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders alerts correctly', () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    expect(screen.getByText('Alertas Inteligentes')).toBeInTheDocument();
    expect(screen.getByText('3 alertas activas')).toBeInTheDocument();
  });

  it('displays alert statistics', () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    expect(screen.getByText('Críticas')).toBeInTheDocument();
    expect(screen.getByText('Altas')).toBeInTheDocument();
    expect(screen.getByText('Medias')).toBeInTheDocument();
    expect(screen.getByText('2 reglas activas')).toBeInTheDocument();
  });

  it('shows empty state when no alerts', () => {
    render(<SmartAlerts alerts={[]} rules={mockRules} />);
    
    expect(screen.getByText('No hay alertas activas')).toBeInTheDocument();
    expect(screen.getByText('Todas las métricas están dentro de los rangos normales')).toBeInTheDocument();
  });

  it('filters alerts by severity', async () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    // Filter by critical severity
    const severityFilter = screen.getByText('Todas las severidades');
    fireEvent.click(severityFilter);
    
    const criticalOption = screen.getByText('Críticas');
    fireEvent.click(criticalOption);
    
    await waitFor(() => {
      expect(screen.getByText('Riesgo Escalado')).toBeInTheDocument();
      expect(screen.queryByText('NCRs Críticas Abiertas')).not.toBeInTheDocument();
    });
  });

  it('filters alerts by category', async () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    // Filter by quality category
    const categoryFilter = screen.getByText('Todas las categorías');
    fireEvent.click(categoryFilter);
    
    const qualityOption = screen.getByText('Calidad');
    fireEvent.click(qualityOption);
    
    await waitFor(() => {
      expect(screen.getByText('NCRs Críticas Abiertas')).toBeInTheDocument();
      expect(screen.queryByText('Indicador por debajo del objetivo')).not.toBeInTheDocument();
    });
  });

  it('acknowledges an alert', async () => {
    const onAcknowledge = vi.fn();
    render(
      <SmartAlerts 
        alerts={mockAlerts} 
        rules={mockRules} 
        onAcknowledge={onAcknowledge}
      />
    );
    
    const acknowledgeButton = screen.getAllByText('Reconocer')[0];
    fireEvent.click(acknowledgeButton);
    
    await waitFor(() => {
      expect(onAcknowledge).toHaveBeenCalledWith('1');
    });
  });

  it('resolves an alert', async () => {
    const onResolve = vi.fn();
    render(
      <SmartAlerts 
        alerts={mockAlerts} 
        rules={mockRules} 
        onResolve={onResolve}
      />
    );
    
    const resolveButton = screen.getAllByText('Resolver')[0];
    fireEvent.click(resolveButton);
    
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('1');
    });
  });

  it('shows alert details in modal', async () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    const alertCard = screen.getByText('NCRs Críticas Abiertas');
    fireEvent.click(alertCard);
    
    await waitFor(() => {
      expect(screen.getByText('Detalles de Alerta')).toBeInTheDocument();
      expect(screen.getByText('NCRs Críticas Abiertas')).toBeInTheDocument();
      expect(screen.getByText('Hay 2 NCRs de severidad crítica abiertas por más de 7 días')).toBeInTheDocument();
    });
  });

  it('displays suggested actions', async () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    const alertCard = screen.getByText('NCRs Críticas Abiertas');
    fireEvent.click(alertCard);
    
    await waitFor(() => {
      expect(screen.getByText('Acciones Sugeridas')).toBeInTheDocument();
      expect(screen.getByText('Revisar asignación de recursos')).toBeInTheDocument();
      expect(screen.getByText('Priorizar acciones correctivas')).toBeInTheDocument();
    });
  });

  it('shows alert timeline', async () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    const alertCard = screen.getByText('NCRs Críticas Abiertas');
    fireEvent.click(alertCard);
    
    await waitFor(() => {
      expect(screen.getByText('Línea de Tiempo')).toBeInTheDocument();
      expect(screen.getByText('Alerta creada')).toBeInTheDocument();
    });
  });

  it('refreshes alerts', async () => {
    const onRefresh = vi.fn();
    render(
      <SmartAlerts 
        alerts={mockAlerts} 
        rules={mockRules} 
        onRefresh={onRefresh}
      />
    );
    
    const refreshButton = screen.getByTestId('refresh-icon');
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('shows different severity indicators', () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    // Check that severity indicators are present
    const alertCards = screen.getAllByTestId('alert-icon');
    expect(alertCards.length).toBeGreaterThan(0);
  });

  it('handles empty rules gracefully', () => {
    render(<SmartAlerts alerts={mockAlerts} rules={[]} />);
    
    expect(screen.getByText('Alertas Inteligentes')).toBeInTheDocument();
    expect(screen.getByText('3 alertas activas')).toBeInTheDocument();
    expect(screen.getByText('0 reglas activas')).toBeInTheDocument();
  });

  it('displays timestamp information', () => {
    render(<SmartAlerts alerts={mockAlerts} rules={mockRules} />);
    
    // Check that timestamps are displayed
    const alertCards = screen.getAllByTestId('clock-icon');
    expect(alertCards.length).toBeGreaterThan(0);
  });
});
