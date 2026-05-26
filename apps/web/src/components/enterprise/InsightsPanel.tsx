'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Shield,
  CheckCircle, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Zap, Target, Eye, ArrowRight, BarChart3, Truck, Users,
  FileText, Clock, AlertCircle, Gauge
} from 'lucide-react';

interface InsightMetric {
  current: number;
  previous?: number;
  change?: number;
  unit?: string;
}

interface Insight {
  id: string;
  type: 'trend' | 'alert' | 'opportunity' | 'anomaly' | 'prediction' | 'recommendation';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'quality' | 'risk' | 'fleet' | 'hr' | 'projects' | 'compliance' | 'financial' | 'operational';
  title: string;
  description: string;
  metric?: InsightMetric;
  recommendations: string[];
  confidence: number;
  createdAt: string;
}

interface Props {
  onAskAbout?: (query: string) => void;
}

const severityConfig: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: AlertTriangle },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: AlertCircle },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: Zap },
  low: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: Eye },
  info: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', icon: Lightbulb },
};

const categoryIcons: Record<string, any> = {
  quality: FileText,
  risk: Shield,
  fleet: Truck,
  hr: Users,
  projects: Target,
  compliance: CheckCircle,
  financial: BarChart3,
  operational: Gauge,
};

export default function InsightsPanel({ onAskAbout }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/command-center/insights') as any;
      setInsights(res?.data || []);
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterSeverity
    ? insights.filter(i => i.severity === filterSeverity)
    : insights;

  const criticalCount = insights.filter(i => i.severity === 'critical' || i.severity === 'high').length;

  return (
    <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-yellow-500/10 rounded-lg">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Insights Proactivos</h3>
            <p className="text-[10px] text-gray-500">{insights.length} insights activos</p>
          </div>
          {criticalCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full">
              {criticalCount} urgentes
            </span>
          )}
        </div>
        <button
          onClick={loadInsights}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Severity Filters */}
      <div className="px-4 py-2 flex gap-1.5 border-b border-gray-700/30">
        <button
          onClick={() => setFilterSeverity(null)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            !filterSeverity ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Todos
        </button>
        {['critical', 'high', 'medium', 'low'].map(sev => {
          const count = insights.filter(i => i.severity === sev).length;
          if (count === 0) return null;
          const cfg = severityConfig[sev];
          return (
            <button
              key={sev}
              onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                filterSeverity === sev ? `${cfg.bg} ${cfg.text}` : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {sev === 'critical' ? 'Crítico' : sev === 'high' ? 'Alto' : sev === 'medium' ? 'Medio' : 'Bajo'}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Insights List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-4">
            <CheckCircle className="w-8 h-8 text-green-500/30 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No hay insights para mostrar</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((insight, idx) => {
              const isExpanded = expandedId === insight.id;
              const cfg = severityConfig[insight.severity] || severityConfig.info;
              const SevIcon = cfg.icon;
              const CatIcon = categoryIcons[insight.category] || Lightbulb;

              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`px-4 py-3 border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors cursor-pointer`}
                  onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${cfg.bg} flex-shrink-0`}>
                      <SevIcon className={`w-3.5 h-3.5 ${cfg.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CatIcon className="w-3 h-3 text-gray-500" />
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{insight.category}</span>
                        {insight.metric?.change && (
                          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
                            insight.metric.change > 0 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {insight.metric.change > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {insight.metric.change > 0 ? '+' : ''}{insight.metric.change}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-200 leading-relaxed">{insight.title}</p>

                      {/* Metric badge */}
                      {insight.metric && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-sm font-bold ${cfg.text}`}>{insight.metric.current}</span>
                          {insight.metric.unit && (
                            <span className="text-[10px] text-gray-500">{insight.metric.unit}</span>
                          )}
                        </div>
                      )}

                      {/* Expanded content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{insight.description}</p>

                            {insight.recommendations.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] font-medium text-gray-500 uppercase">Recomendaciones:</p>
                                {insight.recommendations.map((rec, ri) => (
                                  <div key={ri} className="flex items-start gap-1.5">
                                    <ArrowRight className="w-2.5 h-2.5 text-purple-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[11px] text-gray-400">{rec}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {onAskAbout && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAskAbout(`Analiza en detalle: ${insight.title}`);
                                }}
                                className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 font-medium"
                              >
                                <Zap className="w-3 h-3" />
                                Preguntar a la IA sobre esto
                              </button>
                            )}

                            <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-600">
                              <span>Confianza: {Math.round(insight.confidence * 100)}%</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
