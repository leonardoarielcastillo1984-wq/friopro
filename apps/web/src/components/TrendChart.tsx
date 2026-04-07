'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DataPoint {
  date: string;
  value: number;
  target?: number;
  comparison?: number;
}

interface TrendChartProps {
  data: DataPoint[];
  title?: string;
  type?: 'line' | 'area' | 'bar';
  color?: string;
  showTarget?: boolean;
  showComparison?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
}

const COLORS = {
  primary: '#3B82F6',
  target: '#10B981',
  comparison: '#F59E0B',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  grid: '#E5E7EB',
  text: '#6B7280'
};

export default function TrendChart({
  data,
  title,
  type = 'line',
  color = COLORS.primary,
  showTarget = false,
  showComparison = false,
  height = 280,
  formatValue = (value) => value.toFixed(0)
}: TrendChartProps) {
  const stats = useMemo(() => {
    if (data.length < 2) return null;

    const values = data.map(d => d.value);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;
    
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercent > 2) trend = 'up';
    else if (changePercent < -2) trend = 'down';

    return {
      change,
      changePercent,
      trend,
      average,
      min,
      max,
      firstValue,
      lastValue
    };
  }, [data]);

  // Enhanced data with moving average
  const enhancedData = useMemo(() => {
    return data;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100">
        <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-semibold text-gray-900">
              {formatValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: enhancedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorComparison" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.comparison} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={COLORS.comparison} stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<CustomTooltip />} />
            {showComparison && (
              <Area
                type="monotone"
                dataKey="comparison"
                stroke={COLORS.comparison}
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#colorComparison)"
                name="Período anterior"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              fill="url(#colorValue)"
              name="Valor actual"
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              fill="url(#colorValue)"
              name="Valor actual"
            />
          </AreaChart>
        );
      
      default: // line
        return (
          <LineChart {...commonProps}>
            <defs>
              <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            {showTarget && (
              <ReferenceLine 
                y={data[0]?.target} 
                stroke={COLORS.target} 
                strokeDasharray="5 5" 
                strokeWidth={2}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: color }}
              activeDot={{ r: 6, strokeWidth: 3, fill: '#fff', stroke: color }}
              name="Valor"
            />
          </LineChart>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="text-gray-400 text-sm">Sin datos disponibles</div>
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (!stats) return null;
    if (stats.trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (stats.trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (!stats) return 'text-gray-600';
    if (stats.trend === 'up') return 'text-green-600';
    if (stats.trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {stats && (
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className={`text-sm font-semibold ${getTrendColor()}`}>
                {stats.changePercent >= 0 ? '+' : ''}{stats.changePercent.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">vs. período anterior</span>
            </div>
          )}
        </div>
      )}
      
      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Promedio</div>
              <div className="text-xl font-bold text-gray-900">{formatValue(stats.average)}</div>
            </div>
            <div className="text-center border-l border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mínimo</div>
              <div className="text-xl font-bold text-gray-700">{formatValue(stats.min)}</div>
            </div>
            <div className="text-center border-l border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Máximo</div>
              <div className="text-xl font-bold text-gray-700">{formatValue(stats.max)}</div>
            </div>
            <div className="text-center border-l border-gray-100">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Variación</div>
              <div className={`text-xl font-bold flex items-center justify-center gap-1 ${
                stats.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.changePercent >= 0 ? (
                  <ArrowUpRight className="w-5 h-5" />
                ) : (
                  <ArrowDownRight className="w-5 h-5" />
                )}
                {Math.abs(stats.changePercent).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
