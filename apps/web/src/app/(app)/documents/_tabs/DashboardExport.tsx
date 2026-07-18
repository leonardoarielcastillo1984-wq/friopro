'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  FileText, FileCheck, FileX, Clock, Download,
  LayoutTemplate, GitBranch, Package, TrendingUp,
} from 'lucide-react';

interface Dashboard {
  totalOutputs: number;
  effectiveOutputs: number;
  pendingOutputs: number;
  obsoleteOutputs: number;
  totalExports: number;
  totalTemplates: number;
  totalRevisions: number;
  totalBulkExports: number;
  recentExports: any[];
}

export default function DashboardExport() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>('/doc-export/dashboard')
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando dashboard...</div>;
  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>;
  if (!data) return null;

  const cards = [
    { label: 'Salidas Totales', value: data.totalOutputs, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vigentes', value: data.effectiveOutputs, icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pendientes', value: data.pendingOutputs, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Obsoletos', value: data.obsoleteOutputs, icon: FileX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Exportaciones', value: data.totalExports, icon: Download, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Plantillas', value: data.totalTemplates, icon: LayoutTemplate, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Revisiones', value: data.totalRevisions, icon: GitBranch, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Export. Masivas', value: data.totalBulkExports, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Dashboard del Sistema de Exportación Documental</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${c.bg}`}>
                  <Icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-neutral-800">{c.value}</div>
                  <div className="text-xs text-neutral-400">{c.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.recentExports.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-sm text-neutral-800 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" /> Exportaciones Recientes
          </h3>
          <div className="space-y-2">
            {data.recentExports.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-neutral-50 pb-2">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-neutral-400" />
                  <span className="text-neutral-700">{e.documentTitle || e.fileName}</span>
                  {e.documentCode && <code className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{e.documentCode}</code>}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>{e.exportType === 'CONTROLLED' ? 'Controlada' : 'Informativa'}</span>
                  <span>{new Date(e.createdAt).toLocaleDateString('es-AR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
