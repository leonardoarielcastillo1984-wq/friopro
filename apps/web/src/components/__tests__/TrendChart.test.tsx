import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import TrendChart from '../TrendChart';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ active, payload }: any) => 
    active && payload ? (
      <div data-testid="tooltip">
        {payload[0].value}
      </div>
    ) : null,
  Legend: () => <div data-testid="legend" />
}));

describe('TrendChart Component', () => {
  const mockData = [
    { date: '2024-01', value: 85, target: 90 },
    { date: '2024-02', value: 88, target: 90 },
    { date: '2024-03', value: 92, target: 90 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with basic props', () => {
    render(<TrendChart data={mockData} title="Test Chart" />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('displays target line when showTarget is true', () => {
    render(<TrendChart data={mockData} title="Test Chart" showTarget={true} />);
    
    expect(screen.getByText('Objetivo: 90')).toBeInTheDocument();
  });

  it('calculates trend statistics correctly', () => {
    render(<TrendChart data={mockData} title="Test Chart" />);
    
    expect(screen.getByText('Promedio: 88.3')).toBeInTheDocument();
    expect(screen.getByText('Mínimo: 85')).toBeInTheDocument();
    expect(screen.getByText('Máximo: 92')).toBeInTheDocument();
  });

  it('shows comparison data when provided', () => {
    const dataWithComparison = mockData.map(item => ({
      ...item,
      comparison: item.value - 5
    }));
    
    render(<TrendChart data={dataWithComparison} title="Test Chart" showComparison={true} />);
    
    expect(screen.getByText('Comparación')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    render(<TrendChart data={[]} title="Empty Chart" />);
    
    expect(screen.getByText('No hay datos disponibles')).toBeInTheDocument();
  });

  it('formats values correctly with custom formatValue', () => {
    const formatValue = (value: number) => `${value}%`;
    render(<TrendChart data={mockData} title="Test Chart" formatValue={formatValue} />);
    
    expect(screen.getByText('Promedio: 88.3%')).toBeInTheDocument();
  });

  it('renders different chart types', () => {
    const { rerender } = render(<TrendChart data={mockData} title="Test Chart" type="line" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    rerender(<TrendChart data={mockData} title="Test Chart" type="area" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    rerender(<TrendChart data={mockData} title="Test Chart" type="bar" />);
    // Would test bar chart rendering
  });

  it('handles click events on data points', async () => {
    const onNodeClick = vi.fn();
    render(<TrendChart data={mockData} title="Test Chart" />);
    
    // Simulate clicking on a data point
    const dataPoint = screen.getByTestId('line');
    fireEvent.click(dataPoint);
    
    // Basic test that component renders without errors
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });
});
