'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Activity, Eye, MousePointer, Clock, Calendar,
  TrendingUp, TrendingDown, BarChart3, PieChart, LineChart,
  Download, Filter, RefreshCw, Settings, Target, Zap,
  Monitor, Smartphone, Tablet, Globe, MapPin,
  CheckCircle, AlertCircle, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface UserAnalytics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  userGrowthRate: number;
  retentionRate: number;
  churnRate: number;
  avgSessionDuration: number;
  sessionsPerUser: number;
  topCountries: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  topDevices: Array<{
    device: string;
    users: number;
    percentage: number;
  }>;
  userSegments: Array<{
    segment: string;
    users: number;
    engagement: number;
  }>;
}

interface FeatureAnalytics {
  totalFeatures: number;
  adoptedFeatures: number;
  adoptionRate: number;
  featureUsage: Array<{
    feature: string;
    category: string;
    users: number;
    usage: number;
    adoptionRate: number;
    trend: 'up' | 'down' | 'stable';
    satisfaction: number;
  }>;
  featureCategories: Array<{
    category: string;
    features: number;
    adoptionRate: number;
    avgSatisfaction: number;
  }>;
  timeToAdoption: {
    avgDays: number;
    medianDays: number;
    fastestAdoption: string;
    slowestAdoption: string;
  };
}

interface EngagementMetrics {
  pageViews: number;
  uniquePageViews: number;
  avgPagesPerSession: number;
  bounceRate: number;
  avgTimeOnPage: number;
  topPages: Array<{
    page: string;
    views: number;
    uniqueViews: number;
    avgTime: number;
    bounceRate: number;
  }>;
  userFlows: Array<{
    from: string;
    to: string;
    users: number;
    conversionRate: number;
  }>;
  conversionGoals: Array<{
    goal: string;
    completed: number;
    total: number;
    rate: number;
  }>;
}

interface AdoptionAnalyticsProps {
  className?: string;
}

export default function AdoptionAnalytics({ className = '' }: AdoptionAnalyticsProps) {
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics>({
    dailyActiveUsers: 1247,
    weeklyActiveUsers: 3421,
    monthlyActiveUsers: 8934,
    totalUsers: 15678,
    newUsers: 234,
    returningUsers: 1013,
    userGrowthRate: 12.5,
    retentionRate: 87.3,
    churnRate: 2.8,
    avgSessionDuration: 547, // seconds
    sessionsPerUser: 3.2,
    topCountries: [
      { country: 'España', users: 8934, percentage: 57.0 },
      { country: 'México', users: 2341, percentage: 14.9 },
      { country: 'Argentina', users: 1876, percentage: 12.0 },
      { country: 'Colombia', users: 1234, percentage: 7.9 },
      { country: 'Chile', users: 893, percentage: 5.7 }
    ],
    topDevices: [
      { device: 'Desktop', users: 8934, percentage: 57.0 },
      { device: 'Mobile', users: 5678, percentage: 36.2 },
      { device: 'Tablet', users: 1066, percentage: 6.8 }
    ],
    userSegments: [
      { segment: 'Administradores', users: 234, engagement: 94.2 },
      { segment: 'Gerentes', users: 567, engagement: 87.5 },
      { segment: 'Analistas', users: 1234, engagement: 82.3 },
      { segment: 'Operadores', users: 3456, engagement: 76.8 },
      { segment: 'Consultores', users: 10187, engagement: 71.2 }
    ]
  });

  const [featureAnalytics, setFeatureAnalytics] = useState<FeatureAnalytics>({
    totalFeatures: 45,
    adoptedFeatures: 38,
    adoptionRate: 84.4,
    featureUsage: [
      { feature: 'Dashboard Principal', category: 'Core', users: 14567, usage: 92.9, adoptionRate: 98.7, trend: 'up', satisfaction: 4.6 },
      { feature: 'Gestión de NCRs', category: 'Quality', users: 12345, usage: 78.7, adoptionRate: 89.2, trend: 'up', satisfaction: 4.4 },
      { feature: 'Indicadores KPI', category: 'Analytics', users: 11234, usage: 71.7, adoptionRate: 85.3, trend: 'stable', satisfaction: 4.5 },
      { feature: 'Auditorías', category: 'Compliance', users: 9876, usage: 63.0, adoptionRate: 76.8, trend: 'up', satisfaction: 4.3 },
      { feature: 'Capacitaciones', category: 'HR', users: 8765, usage: 55.9, adoptionRate: 68.9, trend: 'down', satisfaction: 4.2 },
      { feature: 'Gestión de Riesgos', category: 'Risk', users: 7654, usage: 48.8, adoptionRate: 62.3, trend: 'up', satisfaction: 4.1 },
      { feature: 'Automatización', category: 'Productivity', users: 6543, usage: 41.7, adoptionRate: 54.6, trend: 'up', satisfaction: 4.5 },
      { feature: 'Integraciones', category: 'Integration', users: 5432, usage: 34.6, adoptionRate: 45.7, trend: 'stable', satisfaction: 3.9 }
    ],
    featureCategories: [
      { category: 'Core', features: 5, adoptionRate: 96.2, avgSatisfaction: 4.6 },
      { category: 'Quality', features: 8, adoptionRate: 87.3, avgSatisfaction: 4.4 },
      { category: 'Analytics', features: 6, adoptionRate: 79.5, avgSatisfaction: 4.5 },
      { category: 'Compliance', features: 7, adoptionRate: 73.2, avgSatisfaction: 4.3 },
      { category: 'HR', features: 5, adoptionRate: 68.9, avgSatisfaction: 4.2 },
      { category: 'Risk', features: 4, adoptionRate: 62.3, avgSatisfaction: 4.1 },
      { category: 'Productivity', features: 6, adoptionRate: 54.6, avgSatisfaction: 4.5 },
      { category: 'Integration', features: 4, adoptionRate: 45.7, avgSatisfaction: 3.9 }
    ],
    timeToAdoption: {
      avgDays: 14.7,
      medianDays: 12,
      fastestAdoption: 'Dashboard Principal',
      slowestAdoption: 'Integraciones API'
    }
  });

  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    pageViews: 45678,
    uniquePageViews: 23456,
    avgPagesPerSession: 3.7,
    bounceRate: 32.4,
    avgTimeOnPage: 127, // seconds
    topPages: [
      { page: '/dashboard', views: 12345, uniqueViews: 9876, avgTime: 245, bounceRate: 28.3 },
      { page: '/no-conformidades', views: 8765, uniqueViews: 6543, avgTime: 189, bounceRate: 31.2 },
      { page: '/indicadores', views: 7654, uniqueViews: 5432, avgTime: 167, bounceRate: 29.8 },
      { page: '/auditorias', views: 6543, uniqueViews: 4321, avgTime: 156, bounceRate: 33.4 },
      { page: '/capacitaciones', views: 5432, uniqueViews: 3210, avgTime: 134, bounceRate: 35.7 }
    ],
    userFlows: [
      { from: '/dashboard', to: '/no-conformidades', users: 2345, conversionRate: 23.7 },
      { from: '/dashboard', to: '/indicadores', users: 1876, conversionRate: 19.0 },
      { from: '/dashboard', to: '/auditorias', users: 1234, conversionRate: 12.5 },
      { from: '/no-conformidades', to: '/indicadores', users: 876, conversionRate: 10.0 },
      { from: '/indicadores', to: '/auditorias', users: 654, conversionRate: 12.0 }
    ],
    conversionGoals: [
      { goal: 'Crear NCR', completed: 456, total: 567, rate: 80.4 },
      { goal: 'Completar Auditoría', completed: 234, total: 345, rate: 67.8 },
      { goal: 'Generar Informe', completed: 789, total: 1234, rate: 64.0 },
      { goal: 'Registrar Indicador', completed: 345, total: 456, rate: 75.7 }
    ]
  });

  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Simulate real-time updates
      setUserAnalytics(prev => ({
        ...prev,
        dailyActiveUsers: prev.dailyActiveUsers + Math.floor((Math.random() - 0.5) * 10)
      }));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'down': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case 'stable': return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
      default: return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
    }
  };

  const getSatisfactionColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-blue-600';
    if (rating >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAdoptionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const filteredFeatures = featureAnalytics.featureUsage.filter(feature =>
    selectedCategory === 'all' || feature.category === selectedCategory
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Analytics de Adopción</h2>
            <p className="text-sm text-gray-600">Métricas de uso y engagement de usuarios</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1d">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="1y">Último año</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">Todas las categorías</option>
            <option value="Core">Core</option>
            <option value="Quality">Calidad</option>
            <option value="Analytics">Analytics</option>
            <option value="Compliance">Cumplimiento</option>
            <option value="HR">RRHH</option>
            <option value="Risk">Riesgos</option>
            <option value="Productivity">Productividad</option>
            <option value="Integration">Integraciones</option>
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

      {/* User Analytics Overview */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis de Usuarios</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded">
                +{userAnalytics.userGrowthRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {userAnalytics.totalUsers.toLocaleString()}
            </div>
            <div className="text-sm text-blue-700">Usuarios Totales</div>
            <div className="text-xs text-blue-600 mt-1">
              {userAnalytics.dailyActiveUsers} activos hoy
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded">
                {userAnalytics.retentionRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {userAnalytics.monthlyActiveUsers.toLocaleString()}
            </div>
            <div className="text-sm text-green-700">Usuarios Activos Mensuales</div>
            <div className="text-xs text-green-600 mt-1">
              {userAnalytics.newUsers} nuevos este mes
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded">
                {formatDuration(userAnalytics.avgSessionDuration)}
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {userAnalytics.sessionsPerUser}
            </div>
            <div className="text-sm text-purple-700">Sesiones por Usuario</div>
            <div className="text-xs text-purple-600 mt-1">
              Duración promedio
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span className="text-xs font-medium text-orange-600 bg-orange-200 px-2 py-1 rounded">
                {userAnalytics.churnRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {userAnalytics.returningUsers.toLocaleString()}
            </div>
            <div className="text-sm text-orange-700">Usuarios Recurrentes</div>
            <div className="text-xs text-orange-600 mt-1">
              Tasa de retención
            </div>
          </div>
        </div>

        {/* Geographic and Device Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Countries */}
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Distribución Geográfica
            </h4>
            <div className="space-y-2">
              {userAnalytics.topCountries.map((country, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium">{country.country}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{country.users.toLocaleString()}</span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {country.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device Distribution */}
          <div>
            <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Distribución por Dispositivo
            </h4>
            <div className="space-y-2">
              {userAnalytics.topDevices.map((device, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    {device.device === 'Desktop' && <Monitor className="w-4 h-4 text-gray-600" />}
                    {device.device === 'Mobile' && <Smartphone className="w-4 h-4 text-gray-600" />}
                    {device.device === 'Tablet' && <Tablet className="w-4 h-4 text-gray-600" />}
                    <span className="text-sm font-medium">{device.device}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">{device.users.toLocaleString()}</span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {device.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Adoption */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Adopción de Funcionalidades</h3>
        
        {/* Overall Adoption Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{featureAnalytics.totalFeatures}</div>
            <div className="text-sm text-gray-600">Total Funcionalidades</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-900">{featureAnalytics.adoptedFeatures}</div>
            <div className="text-sm text-gray-600">Funcionalidades Adoptadas</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className={`text-2xl font-bold ${getAdoptionColor(featureAnalytics.adoptionRate)}`}>
              {featureAnalytics.adoptionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Tasa de Adopción</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-900">{featureAnalytics.timeToAdoption.avgDays.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Días Promedio para Adopción</div>
          </div>
        </div>

        {/* Feature Usage Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funcionalidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuarios
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adopción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Satisfacción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tendencia
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFeatures.map((feature, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {feature.feature}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {feature.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {feature.users.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {feature.usage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${getAdoptionColor(feature.adoptionRate)}`}>
                      {feature.adoptionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${getSatisfactionColor(feature.satisfaction)}`}>
                      {feature.satisfaction}/5
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getTrendIcon(feature.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Métricas de Engagement</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Eye className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded">
                {engagementMetrics.avgPagesPerSession.toFixed(1)}
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {engagementMetrics.pageViews.toLocaleString()}
            </div>
            <div className="text-sm text-blue-700">Vistas de Página</div>
            <div className="text-xs text-blue-600 mt-1">
              {engagementMetrics.uniquePageViews.toLocaleString()} únicas
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <MousePointer className="w-5 h-5 text-green-600" />
              <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded">
                {engagementMetrics.bounceRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {formatDuration(engagementMetrics.avgTimeOnPage)}
            </div>
            <div className="text-sm text-green-700">Tiempo Promedio en Página</div>
            <div className="text-xs text-green-600 mt-1">
              Por sesión
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded">
                4 objetivos
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              71.9%
            </div>
            <div className="text-sm text-purple-700">Tasa de Conversión Promedio</div>
            <div className="text-xs text-purple-600 mt-1">
              Todos los objetivos
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-orange-600" />
              <span className="text-xs font-medium text-orange-600 bg-orange-200 px-2 py-1 rounded">
                5 flujos
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              15.4%
            </div>
            <div className="text-sm text-orange-700">Tasa de Conversión de Flujos</div>
            <div className="text-xs text-orange-600 mt-1">
              Promedio
            </div>
          </div>
        </div>

        {/* Conversion Goals */}
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3">Objetivos de Conversión</h4>
          <div className="space-y-3">
            {engagementMetrics.conversionGoals.map((goal, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{goal.goal}</span>
                    <span className={`text-sm font-medium ${
                      goal.rate >= 80 ? 'text-green-600' :
                      goal.rate >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {goal.rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        goal.rate >= 80 ? 'bg-green-500' :
                        goal.rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${goal.rate}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {goal.completed} de {goal.total} completados
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Segments */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Segmentos de Usuarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userAnalytics.userSegments.map((segment, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{segment.segment}</span>
                <span className="text-xs text-gray-600">{segment.users.toLocaleString()} usuarios</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Engagement</span>
                <span className={`text-sm font-medium ${
                  segment.engagement >= 80 ? 'text-green-600' :
                  segment.engagement >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {segment.engagement.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    segment.engagement >= 80 ? 'bg-green-500' :
                    segment.engagement >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${segment.engagement}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
