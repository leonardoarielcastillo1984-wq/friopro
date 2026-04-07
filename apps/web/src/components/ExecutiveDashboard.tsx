'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Target, AlertTriangle,
  BarChart3, PieChart, LineChart, Activity, Calendar, Download,
  Filter, Settings, RefreshCw, Eye, Brain, Zap, Award, Globe,
  Building2, Briefcase, FileText, CheckCircle, Clock, ArrowUpRight,
  ArrowDownRight, Minus, Star, Flag, Shield, Rocket
} from 'lucide-react';

interface ExecutiveMetrics {
  revenue: {
    current: number;
    previous: number;
    growth: number;
    target: number;
    achievement: number;
  };
  profit: {
    current: number;
    previous: number;
    margin: number;
    growth: number;
  };
  customers: {
    total: number;
    new: number;
    churn: number;
    satisfaction: number;
    retention: number;
  };
  operations: {
    efficiency: number;
    productivity: number;
    quality: number;
    compliance: number;
  };
  employees: {
    total: number;
    engaged: number;
    turnover: number;
    training: number;
  };
  projects: {
    active: number;
    completed: number;
    onTime: number;
    budget: number;
  };
}

interface KPIData {
  name: string;
  value: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  category: 'financial' | 'operational' | 'customer' | 'employee';
}

interface PredictiveAnalytics {
  revenue: {
    nextMonth: number;
    nextQuarter: number;
    nextYear: number;
    confidence: number;
  };
  risks: Array<{
    type: 'financial' | 'operational' | 'market' | 'compliance';
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    probability: number;
    impact: number;
    mitigation: string;
  }>;
  opportunities: Array<{
    type: 'growth' | 'efficiency' | 'innovation' | 'market';
    description: string;
    potential: number;
    feasibility: number;
    timeline: string;
  }>;
}

interface ExecutiveDashboardProps {
  className?: string;
}

export default function ExecutiveDashboard({ className = '' }: ExecutiveDashboardProps) {
  const [metrics, setMetrics] = useState<ExecutiveMetrics>({
    revenue: { current: 2450000, previous: 2100000, growth: 16.7, target: 2500000, achievement: 98 },
    profit: { current: 480000, previous: 420000, margin: 19.6, growth: 14.3 },
    customers: { total: 1250, new: 85, churn: 2.3, satisfaction: 4.2, retention: 97.7 },
    operations: { efficiency: 87, productivity: 92, quality: 94, compliance: 98 },
    employees: { total: 145, engaged: 78, turnover: 8.5, training: 92 },
    projects: { active: 12, completed: 28, onTime: 85, budget: 78 }
  });

  const [kpiData, setKpiData] = useState<KPIData[]>([
    { name: 'Ingresos Mensuales', value: 2450000, target: 2500000, trend: 'up', change: 16.7, status: 'good', category: 'financial' },
    { name: 'Margen de Beneficio', value: 19.6, target: 20, trend: 'up', change: 2.3, status: 'good', category: 'financial' },
    { name: 'Satisfacción Cliente', value: 4.2, target: 4.5, trend: 'stable', change: 0, status: 'good', category: 'customer' },
    { name: 'Tasa de Retención', value: 97.7, target: 95, trend: 'up', change: 1.2, status: 'excellent', category: 'customer' },
    { name: 'Eficiencia Operativa', value: 87, target: 90, trend: 'up', change: 5.3, status: 'good', category: 'operational' },
    { name: 'Índice de Calidad', value: 94, target: 95, trend: 'down', change: -1.2, status: 'warning', category: 'operational' },
    { name: 'Cumplimiento Normativo', value: 98, target: 100, trend: 'up', change: 2.1, status: 'excellent', category: 'operational' },
    { name: 'Engagement Empleados', value: 78, target: 80, trend: 'stable', change: 0, status: 'good', category: 'employee' },
    { name: 'Proyectos a Tiempo', value: 85, target: 90, trend: 'down', change: -3.2, status: 'warning', category: 'operational' },
    { name: 'Presupuesto Proyectos', value: 78, target: 85, trend: 'up', change: 4.5, status: 'good', category: 'operational' }
  ]);

  const [predictiveAnalytics, setPredictiveAnalytics] = useState<PredictiveAnalytics>({
    revenue: {
      nextMonth: 2580000,
      nextQuarter: 7800000,
      nextYear: 31200000,
      confidence: 87
    },
    risks: [
      {
        type: 'market',
        level: 'medium',
        description: 'Disminución de la demanda del sector',
        probability: 35,
        impact: 65,
        mitigation: 'Diversificar cartera de clientes'
      },
      {
        type: 'operational',
        level: 'low',
        description: 'Falta de personal clave en áreas críticas',
        probability: 25,
        impact: 45,
        mitigation: 'Programa de sucesión y capacitación'
      },
      {
        type: 'financial',
        level: 'low',
        description: 'Variabilidad en costos de materias primas',
        probability: 30,
        impact: 40,
        mitigation: 'Contratos a largo plazo con proveedores'
      }
    ],
    opportunities: [
      {
        type: 'growth',
        description: 'Expansión a nuevos mercados regionales',
        potential: 2500000,
        feasibility: 75,
        timeline: '6-12 meses'
      },
      {
        type: 'efficiency',
        description: 'Automatización de procesos repetitivos',
        potential: 450000,
        feasibility: 85,
        timeline: '3-6 meses'
      },
      {
        type: 'innovation',
        description: 'Lanzamiento de nueva línea de servicios',
        potential: 1200000,
        feasibility: 60,
        timeline: '12-18 meses'
      }
    ]
  });

  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Simulate real-time updates
      setMetrics(prev => ({
        ...prev,
        revenue: {
          ...prev.revenue,
          current: prev.revenue.current + Math.floor((Math.random() - 0.5) * 10000)
        }
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'down': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case 'stable': return <Minus className="w-4 h-4 text-gray-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Bueno';
      case 'warning': return 'Precaución';
      case 'critical': return 'Crítico';
      default: return status;
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getOpportunityTypeIcon = (type: string) => {
    switch (type) {
      case 'growth': return <Rocket className="w-4 h-4" />;
      case 'efficiency': return <Zap className="w-4 h-4" />;
      case 'innovation': return <Brain className="w-4 h-4" />;
      case 'market': return <Globe className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const filteredKPIs = kpiData.filter(kpi => 
    selectedCategory === 'all' || kpi.category === selectedCategory
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(value);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Dashboard Ejecutivo</h2>
            <p className="text-sm text-gray-600">Business Intelligence y Analytics Avanzado</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="day">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="quarter">Este Trimestre</option>
            <option value="year">Este Año</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Todas las Categorías</option>
            <option value="financial">Financiero</option>
            <option value="operational">Operacional</option>
            <option value="customer">Cliente</option>
            <option value="employee">Empleado</option>
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>

          <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas Clave</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Revenue */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded">
                +{metrics.revenue.growth.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(metrics.revenue.current)}
            </div>
            <div className="text-sm text-blue-700">Ingresos</div>
            <div className="text-xs text-blue-600 mt-1">
              {metrics.revenue.achievement}% del objetivo
            </div>
          </div>

          {/* Profit */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded">
                {metrics.profit.margin.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {formatCurrency(metrics.profit.current)}
            </div>
            <div className="text-sm text-green-700">Beneficio</div>
            <div className="text-xs text-green-600 mt-1">
              +{metrics.profit.growth.toFixed(1)}% vs anterior
            </div>
          </div>

          {/* Customers */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {formatNumber(metrics.customers.total)}
            </div>
            <div className="text-sm text-purple-700">Clientes</div>
            <div className="text-xs text-purple-600 mt-1">
              {metrics.customers.satisfaction}/5 satisfacción
            </div>
          </div>

          {/* Operations */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-orange-600" />
              <Shield className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {metrics.operations.efficiency}%
            </div>
            <div className="text-sm text-orange-700">Eficiencia</div>
            <div className="text-xs text-orange-600 mt-1">
              {metrics.operations.compliance}% cumplimiento
            </div>
          </div>

          {/* Projects */}
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-pink-600" />
              <CheckCircle className="w-4 h-5 text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-pink-900">
              {metrics.projects.active}
            </div>
            <div className="text-sm text-pink-700">Proyectos Activos</div>
            <div className="text-xs text-pink-600 mt-1">
              {metrics.projects.onTime}% a tiempo
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Indicadores Clave de Rendimiento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {filteredKPIs.map((kpi, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{kpi.name}</span>
                {getTrendIcon(kpi.trend)}
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1">
                {kpi.category === 'financial' ? formatCurrency(kpi.value) : 
                 kpi.name.includes('Satisfacción') ? `${kpi.value}/5` :
                 `${kpi.value}%`}
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">Objetivo: {kpi.category === 'financial' ? formatCurrency(kpi.target) : `${kpi.target}%`}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(kpi.status)}`}>
                  {getStatusLabel(kpi.status)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    kpi.status === 'excellent' ? 'bg-green-500' :
                    kpi.status === 'good' ? 'bg-blue-500' :
                    kpi.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive Analytics */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Predictivos</h3>
        
        {/* Revenue Forecast */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-800 mb-3">Pronóstico de Ingresos</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Próximo Mes</div>
              <div className="text-xl font-bold text-blue-900">
                {formatCurrency(predictiveAnalytics.revenue.nextMonth)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Confianza: {predictiveAnalytics.revenue.confidence}%
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 mb-1">Próximo Trimestre</div>
              <div className="text-xl font-bold text-purple-900">
                {formatCurrency(predictiveAnalytics.revenue.nextQuarter)}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                Basado en tendencias históricas
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 mb-1">Próximo Año</div>
              <div className="text-xl font-bold text-green-900">
                {formatCurrency(predictiveAnalytics.revenue.nextYear)}
              </div>
              <div className="text-xs text-green-600 mt-1">
                Proyección a 12 meses
              </div>
            </div>
          </div>
        </div>

        {/* Risks and Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risks */}
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Riesgos Identificados
            </h4>
            <div className="space-y-3">
              {predictiveAnalytics.risks.map((risk, index) => (
                <div key={index} className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskLevelColor(risk.level)}`}>
                      {risk.level}
                    </span>
                    <span className="text-xs text-gray-600">
                      {risk.probability}% probabilidad
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mb-1">{risk.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Impacto: {risk.impact}%</span>
                    <span className="text-xs text-blue-600">{risk.mitigation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunities */}
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-green-600" />
              Oportunidades de Crecimiento
            </h4>
            <div className="space-y-3">
              {predictiveAnalytics.opportunities.map((opportunity, index) => (
                <div key={index} className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getOpportunityTypeIcon(opportunity.type)}
                      <span className="text-sm font-medium text-gray-800">
                        {opportunity.type === 'growth' ? 'Crecimiento' :
                         opportunity.type === 'efficiency' ? 'Eficiencia' :
                         opportunity.type === 'innovation' ? 'Innovación' : 'Mercado'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600">{opportunity.timeline}</span>
                  </div>
                  <p className="text-sm text-gray-800 mb-1">{opportunity.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      Potencial: {formatCurrency(opportunity.potential)}
                    </span>
                    <span className="text-xs text-blue-600">
                      Factibilidad: {opportunity.feasibility}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Recomendadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-800">Atención Inmediata</span>
            </div>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Revisar índice de calidad (94% vs 95% objetivo)</li>
              <li>• Analizar causas de retraso en proyectos (85% vs 90%)</li>
              <li>• Implementar plan de mejora continua</li>
            </ul>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Corto Plazo (30 días)</span>
            </div>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Optimizar procesos para mejorar eficiencia</li>
              <li>• Lanzar programa de retención de clientes</li>
              <li>• Evaluar oportunidades de automatización</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">Mediano Plazo (90 días)</span>
            </div>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Expandir a nuevos mercados regionales</li>
              <li>• Desarrollar nueva línea de servicios</li>
              <li>• Implementar sistema de BI avanzado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
