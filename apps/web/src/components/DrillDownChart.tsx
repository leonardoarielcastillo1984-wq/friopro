'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Treemap
} from 'recharts';
import { ArrowRight, ArrowLeft, Search, Filter, TrendingUp } from 'lucide-react';

interface DrillDownLevel {
  id: string;
  name: string;
  type: 'category' | 'subcategory' | 'detail' | 'metric';
  data: any[];
  parent?: string;
  children?: string[];
}

interface DrillDownNode {
  name: string;
  value: number;
  count?: number;
  percentage?: number;
  color?: string;
  metadata?: Record<string, any>;
  drillDownKey?: string;
}

interface DrillDownChartProps {
  data: DrillDownNode[];
  levels: DrillDownLevel[];
  onNodeClick?: (node: DrillDownNode, level: DrillDownLevel) => void;
  onFilter?: (filters: Record<string, any>) => void;
  height?: number;
  className?: string;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
];

export default function DrillDownChart({
  data,
  levels,
  onNodeClick,
  onFilter,
  height = 400,
  className = ''
}: DrillDownChartProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentData, setCurrentData] = useState(data);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<DrillDownNode | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'treemap'>('bar');

  const currentLevelConfig = levels[currentLevel];

  const navigateToLevel = (levelIndex: number, node?: DrillDownNode) => {
    if (levelIndex < 0 || levelIndex >= levels.length) return;

    const targetLevel = levels[levelIndex];
    let newData = data;

    // Filter data based on breadcrumb path
    if (breadcrumb.length > 0) {
      newData = data.filter(item => {
        return breadcrumb.every((crumb, index) => {
          if (index === 0) return item.name === breadcrumb[0];
          // Add more complex filtering logic for deeper levels
          return true;
        });
      });
    }

    // If we have a specific node, navigate to its children
    if (node && node.drillDownKey) {
      newData = data.filter(item => item.drillDownKey === node.drillDownKey);
    }

    setCurrentLevel(levelIndex);
    setCurrentData(newData);
    
    // Update breadcrumb
    if (levelIndex === 0) {
      setBreadcrumb([]);
    } else if (node) {
      setBreadcrumb(prev => [...prev.slice(0, levelIndex), node.name]);
    }
  };

  const handleNodeClick = (node: DrillDownNode) => {
    setSelectedNode(node);
    
    // Check if this node has children (can drill down)
    const hasChildren = node.drillDownKey || 
      data.some(item => item.drillDownKey === node.name);

    if (hasChildren && currentLevel < levels.length - 1) {
      navigateToLevel(currentLevel + 1, node);
    }

    onNodeClick?.(node, currentLevelConfig);
  };

  const handleBreadcrumbClick = (index: number) => {
    navigateToLevel(index);
  };

  const goBack = () => {
    if (currentLevel > 0) {
      navigateToLevel(currentLevel - 1);
    }
  };

  const reset = () => {
    setCurrentLevel(0);
    setCurrentData(data);
    setBreadcrumb([]);
    setSelectedNode(null);
  };

  const renderChart = () => {
    const chartData = currentData.map(item => ({
      ...item,
      fill: item.color || COLORS[currentData.indexOf(item) % COLORS.length]
    }));

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => {
                  const percentage = (value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100;
                  return `${name} (${percentage.toFixed(1)}%)`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={(data: any, index: number) => handleNodeClick(data)}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any, name: any, props: any) => {
                  const percentage = (value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100;
                  return [
                    value,
                    name,
                    `(${percentage.toFixed(1)}%)`
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <Treemap
              data={chartData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#8884d8"
              content={({ x, y, width, height, name, value }: any) => {
                  const node = chartData.find(d => d.name === name);
                  if (!node) return <g />;
                  
                  const percentage = (value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100;
                  
                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        style={{
                          fill: node.fill || '#8884d8',
                          stroke: '#fff',
                          strokeWidth: 2,
                          cursor: 'pointer'
                        }}
                        onClick={() => handleNodeClick(node)}
                      />
                      {width > 50 && height > 30 && (
                        <>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 - 8}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={12}
                            fontWeight="bold"
                          >
                            {name}
                          </text>
                          <text
                            x={x + width / 2}
                            y={y + height / 2 + 8}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={10}
                          >
                            {value}
                            {percentage && ` (${percentage.toFixed(1)}%)`}
                          </text>
                        </>
                      )}
                    </g>
                  );
                }}
            />
          </ResponsiveContainer>
        );

      default: // bar
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                stroke="#6B7280"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6B7280"
              />
              <Tooltip 
                formatter={(value: any, name: any) => {
                  const percentage = (value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100;
                  return [
                    value,
                    name,
                    `(${percentage.toFixed(1)}%)`
                  ];
                }}
              />
              <Bar
                dataKey="value"
                fill="#3B82F6"
                onClick={(data: any) => handleNodeClick(data)}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const getStats = () => {
    const total = currentData.reduce((sum, item) => sum + item.value, 0);
    const average = total / currentData.length;
    const max = Math.max(...currentData.map(item => item.value));
    const min = Math.min(...currentData.map(item => item.value));

    return { total, average, max, min };
  };

  const stats = getStats();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {currentLevelConfig.name}
            </h3>
            <div className="text-sm text-gray-600 mt-1">
              Nivel {currentLevel + 1} de {levels.length}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chart Type Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'bar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Barras
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'pie' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Circular
              </button>
              <button
                onClick={() => setChartType('treemap')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  chartType === 'treemap' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Árbol
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              {currentLevel > 0 && (
                <button
                  onClick={goBack}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  title="Nivel anterior"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              
              <button
                onClick={reset}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                title="Reiniciar"
              >
                <TrendingUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            <button
              onClick={() => handleBreadcrumbClick(0)}
              className="text-blue-600 hover:text-blue-700"
            >
              Inicio
            </button>
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={index}>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <button
                  onClick={() => handleBreadcrumbClick(index + 1)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total</div>
            <div className="font-medium text-gray-900">{stats.total.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-gray-600">Promedio</div>
            <div className="font-medium text-gray-900">{stats.average.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-gray-600">Máximo</div>
            <div className="font-medium text-gray-900">{stats.max.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-gray-600">Mínimo</div>
            <div className="font-medium text-gray-900">{stats.min.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {currentData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No hay datos para este nivel</p>
            </div>
          </div>
        ) : (
          renderChart()
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Detalles: {selectedNode.name}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Valor:</span>
                  <span className="font-medium text-gray-900 ml-2">
                    {selectedNode.value.toFixed(1)}
                  </span>
                </div>
                {selectedNode.count && (
                  <div>
                    <span className="text-gray-600">Cantidad:</span>
                    <span className="font-medium text-gray-900 ml-2">
                      {selectedNode.count}
                    </span>
                  </div>
                )}
                {selectedNode.percentage && (
                  <div>
                    <span className="text-gray-600">Porcentaje:</span>
                    <span className="font-medium text-gray-900 ml-2">
                      {selectedNode.percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              
              {selectedNode.metadata && (
                <div className="mt-2">
                  <h5 className="font-medium text-blue-900 mb-1">Metadatos</h5>
                  <div className="space-y-1 text-sm">
                    {Object.entries(selectedNode.metadata).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium text-gray-900 ml-2">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {selectedNode.drillDownKey && currentLevel < levels.length - 1 && (
                <button
                  onClick={() => navigateToLevel(currentLevel + 1, selectedNode)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <ArrowRight className="w-3 h-3" />
                  Drill Down
                </button>
              )}
              
              {onFilter && (
                <button
                  onClick={() => onFilter({ [currentLevelConfig.id]: selectedNode.name })}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  <Filter className="w-3 h-3" />
                  Filtrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
