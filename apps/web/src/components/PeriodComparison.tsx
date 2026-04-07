'use client';

import { useState, useMemo } from 'react';
import {
  Calendar, ChevronDown, TrendingUp, TrendingDown, Minus,
  BarChart3, ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';

interface ComparisonData {
  current: number;
  previous: number;
  target?: number;
  label: string;
  unit?: string;
  format?: (value: number) => string;
}

interface PeriodComparisonProps {
  data: ComparisonData[];
  currentPeriod: string;
  previousPeriod: string;
  showTarget?: boolean;
  className?: string;
}

const COLORS = {
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',
  target: '#3B82F6'
};

export default function PeriodComparison({
  data,
  currentPeriod,
  previousPeriod,
  showTarget = true,
  className = ''
}: PeriodComparisonProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, percent: 0, direction: 'neutral' as const };
    
    const change = current - previous;
    const percent = (change / previous) * 100;
    
    let direction: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (percent > 1) direction = 'positive';
    else if (percent < -1) direction = 'negative';
    
    return { value: change, percent, direction };
  };

  const formatValue = (value: number, format?: (value: number) => string, unit?: string) => {
    if (format) return format(value);
    return `${value.toFixed(1)}${unit || ''}`;
  };

  const getChangeIcon = (direction: 'positive' | 'negative' | 'neutral') => {
    switch (direction) {
      case 'positive': return <TrendingUp className="w-4 h-4" />;
      case 'negative': return <TrendingDown className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const getChangeColor = (direction: 'positive' | 'negative' | 'neutral') => {
    switch (direction) {
      case 'positive': return COLORS.positive;
      case 'negative': return COLORS.negative;
      default: return COLORS.neutral;
    }
  };

  const overallStats = useMemo(() => {
    const totalCurrent = data.reduce((sum, item) => sum + item.current, 0);
    const totalPrevious = data.reduce((sum, item) => sum + item.previous, 0);
    const totalTarget = data.reduce((sum, item) => sum + (item.target || 0), 0);
    
    const overallChange = calculateChange(totalCurrent, totalPrevious);
    const targetAchievement = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    
    return {
      totalCurrent,
      totalPrevious,
      totalTarget,
      overallChange,
      targetAchievement
    };
  }, [data]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Comparativa de Períodos</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <span className="font-medium">{currentPeriod}</span>
              <span>vs</span>
              <span>{previousPeriod}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${
              overallStats.overallChange.direction === 'positive' ? 'bg-green-50 text-green-700' :
              overallStats.overallChange.direction === 'negative' ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-700'
            }`}>
              {getChangeIcon(overallStats.overallChange.direction)}
              <span className="font-medium">
                {overallStats.overallChange.percent >= 0 ? '+' : ''}
                {overallStats.overallChange.percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(overallStats.totalCurrent)}
            </div>
            <div className="text-sm text-gray-600">Período Actual</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(overallStats.totalPrevious)}
            </div>
            <div className="text-sm text-gray-600">Período Anterior</div>
          </div>
          {showTarget && (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {overallStats.targetAchievement.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Logro de Objetivo</div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Comparison */}
      <div className="p-4 space-y-3">
        {data.map((item, index) => {
          const change = calculateChange(item.current, item.previous);
          const targetAchievement = item.target ? (item.current / item.target) * 100 : 0;
          const isExpanded = expandedItem === item.label;

          return (
            <div
              key={item.label}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setExpandedItem(isExpanded ? null : item.label)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{item.label}</div>
                      <div className="text-sm text-gray-600">
                        {formatValue(item.current, item.format, item.unit)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Target Achievement */}
                    {showTarget && item.target && (
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Objetivo</div>
                        <div className="font-medium text-blue-600">
                          {targetAchievement.toFixed(1)}%
                        </div>
                      </div>
                    )}
                    
                    {/* Change */}
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                      change.direction === 'positive' ? 'bg-green-50 text-green-700' :
                      change.direction === 'negative' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {getChangeIcon(change.direction)}
                      <span className="font-medium text-sm">
                        {change.percent >= 0 ? '+' : ''}{change.percent.toFixed(1)}%
                      </span>
                    </div>
                    
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`} />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Actual: {formatValue(item.current, item.format, item.unit)}</span>
                    <span>Anterior: {formatValue(item.previous, item.format, item.unit)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500"
                        style={{ width: `${Math.min((item.current / (item.target || item.current * 1.2)) * 100, 100)}%` }}
                      />
                      <div
                        className="bg-gray-400 opacity-50"
                        style={{ width: `${Math.min((item.previous / (item.target || item.current * 1.2)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Detalles del Cambio</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Valor Actual:</span>
                          <span className="font-medium">
                            {formatValue(item.current, item.format, item.unit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Valor Anterior:</span>
                          <span className="font-medium">
                            {formatValue(item.previous, item.format, item.unit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cambio Absoluto:</span>
                          <span className={`font-medium ${getChangeColor(change.direction)}`}>
                            {change.value >= 0 ? '+' : ''}{formatValue(change.value, item.format, item.unit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cambio Porcentual:</span>
                          <span className={`font-medium ${getChangeColor(change.direction)}`}>
                            {change.percent >= 0 ? '+' : ''}{change.percent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {showTarget && item.target && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Análisis de Objetivo</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Objetivo:</span>
                            <span className="font-medium text-blue-600">
                              {formatValue(item.target, item.format, item.unit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Logro:</span>
                            <span className={`font-medium ${
                              targetAchievement >= 100 ? 'text-green-600' :
                              targetAchievement >= 80 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {targetAchievement.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Desvío:</span>
                            <span className={`font-medium ${
                              targetAchievement >= 100 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {targetAchievement >= 100 ? '+' : ''}
                              {formatValue(item.current - item.target, item.format, item.unit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Insights */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <div className="font-medium">Análisis</div>
                        <div className="mt-1">
                          {change.direction === 'positive' 
                            ? `Mejora del ${Math.abs(change.percent).toFixed(1)}% respecto al período anterior.`
                            : change.direction === 'negative'
                            ? `Declinación del ${Math.abs(change.percent).toFixed(1)}% respecto al período anterior.`
                            : 'Mantiene niveles similares al período anterior.'
                          }
                          {item.target && (
                            <span className="mt-1 block">
                              {targetAchievement >= 100
                                ? ' Supera el objetivo establecido.'
                                : targetAchievement >= 80
                                ? ' Cerca de alcanzar el objetivo.'
                                : ' Requiere atención para alcanzar el objetivo.'
                              }
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
