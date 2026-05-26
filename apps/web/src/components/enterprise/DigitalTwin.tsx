'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Activity, AlertTriangle, Shield, Truck, Users, Kanban,
  Loader2, RefreshCw, Zap, GitBranch, Eye
} from 'lucide-react';

interface TwinNode {
  id: string;
  type: string;
  label: string;
  color?: string;
  count?: number;
  status?: string;
  x: number;
  y: number;
}

interface TwinEdge {
  source: string;
  target: string;
  type: string;
  strength?: number;
  label?: string;
  severity?: string;
}

interface CorrelationInsight {
  title: string;
  description: string;
  severity: string;
  recommendation: string;
  confidence: number;
  dataSources: string[];
}

interface Anomaly {
  id: string;
  type: string;
  module: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
}

const MODULE_ICONS: Record<string, any> = {
  fleet: Truck,
  hr: Users,
  projects: Kanban,
  quality: Shield,
  risks: AlertTriangle,
  org: Activity,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#6b7280',
};

export default function DigitalTwin() {
  const [nodes, setNodes] = useState<TwinNode[]>([]);
  const [edges, setEdges] = useState<TwinEdge[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/command-center/digital-twin') as any;
      if (res?.data) {
        setNodes(res.data.nodes || []);
        setEdges(res.data.edges || []);
        setCorrelations(res.data.correlations || []);
        setAnomalies(res.data.anomalies || []);
      }
    } catch (err) {
      console.error('Digital Twin error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Cargando Digital Twin...</p>
        </div>
      </div>
    );
  }

  const mainNodes = nodes.filter(n => n.type === 'module' || n.type === 'organization');
  const correlationEdges = edges.filter(e => e.type !== 'contains');

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-bold text-gray-200">Digital Twin Organizacional</h2>
          <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] text-purple-300 font-bold">LIVE</span>
        </div>
        <button onClick={loadData} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Graph Area */}
        <div className="flex-1 relative overflow-hidden p-4">
          <svg className="w-full h-full absolute inset-0" style={{ minHeight: '400px' }}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const sourceNode = mainNodes.find(n => n.id === edge.source);
              const targetNode = mainNodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isCorrelation = edge.type !== 'contains';
              const color = isCorrelation ? (SEVERITY_COLORS[edge.severity || 'info'] || '#6b7280') : '#374151';
              const opacity = hoveredEdge === i ? 1 : (isCorrelation ? 0.6 : 0.3);
              const strokeWidth = isCorrelation ? (edge.strength || 0.5) * 3 + 1 : 1;

              return (
                <g key={i} onMouseEnter={() => setHoveredEdge(i)} onMouseLeave={() => setHoveredEdge(null)}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    strokeDasharray={isCorrelation ? '4 2' : undefined}
                  />
                  {isCorrelation && hoveredEdge === i && edge.label && (
                    <text
                      x={(sourceNode.x + targetNode.x) / 2}
                      y={(sourceNode.y + targetNode.y) / 2 - 8}
                      textAnchor="middle"
                      className="text-[9px] fill-gray-300"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {mainNodes.map((node) => {
            const Icon = MODULE_ICONS[node.id] || Activity;
            const isSelected = selectedNode === node.id;
            const isOrg = node.type === 'organization';

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                className={`absolute cursor-pointer transition-all ${isSelected ? 'z-10' : 'z-0'}`}
                style={{
                  left: node.x - (isOrg ? 36 : 28),
                  top: node.y - (isOrg ? 36 : 28),
                }}
              >
                <div
                  className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all ${
                    isSelected ? 'ring-2 ring-purple-400/50 scale-110' : 'hover:scale-105'
                  } ${isOrg ? 'w-[72px] h-[72px]' : 'w-[56px] h-[56px]'}`}
                  style={{
                    backgroundColor: (node.color || '#6366f1') + '20',
                    borderColor: (node.color || '#6366f1') + '60',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: node.color || '#6366f1' }} />
                  {node.count !== undefined && (
                    <span className="text-[9px] font-bold text-gray-300 mt-0.5">{node.count}</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-1 font-medium">{node.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Right Panel: Correlations + Anomalies */}
        <div className="w-[320px] border-l border-gray-800/60 overflow-y-auto p-3 space-y-4 flex-shrink-0">
          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-red-400" />
                Anomalías Detectadas ({anomalies.length})
              </h3>
              <div className="space-y-2">
                {anomalies.slice(0, 5).map((a, i) => (
                  <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLORS[a.severity] }}
                      />
                      <span className="text-[10px] font-semibold text-gray-200 flex-1">{a.title}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1.5">{a.description}</p>
                    <p className="text-[9px] text-purple-300 italic">{a.recommendation}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] text-gray-500">{a.module}</span>
                      <span className="text-[8px] text-gray-600">|</span>
                      <span className="text-[8px] text-gray-500">{Math.round(a.confidence * 100)}% confianza</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlations */}
          {correlations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                Correlaciones Cross-Module ({correlations.length})
              </h3>
              <div className="space-y-2">
                {correlations.slice(0, 5).map((c, i) => (
                  <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLORS[c.severity] }}
                      />
                      <span className="text-[10px] font-semibold text-gray-200 flex-1">{c.title}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1">{c.description}</p>
                    <p className="text-[9px] text-blue-300 italic">{c.recommendation}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {c.dataSources.map((ds, di) => (
                        <span key={di} className="text-[8px] px-1.5 py-0.5 bg-gray-700/50 rounded text-gray-400">{ds}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {anomalies.length === 0 && correlations.length === 0 && (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 text-green-500/50 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Sin anomalías ni correlaciones de riesgo</p>
              <p className="text-[10px] text-gray-600 mt-1">El sistema está operando normalmente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
