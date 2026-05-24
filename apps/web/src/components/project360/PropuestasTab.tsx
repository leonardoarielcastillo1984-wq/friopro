'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  FileText, Download, Plus, Sparkles, CheckCircle, Clock,
  FileSpreadsheet, Presentation, FileCode, Trash2, Eye,
  Calendar, DollarSign, Users, AlertCircle
} from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  status: string;
  technicalProposal: string | null;
  operationalScope: string | null;
  timeline: string | null;
  resourceMatrix: any | null;
  exclusions: string | null;
  risks: string | null;
  executiveSummary: string | null;
  managementSummary: string | null;
  ganttData: any | null;
  preliminaryBudget: any | null;
  generatedAt: string | null;
  iaModelUsed: string | null;
  costEstimate: number | null;
  marginEstimate: number | null;
}

interface Props {
  projectId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  GENERANDO: { label: 'Generando...', color: 'bg-blue-100 text-blue-700', icon: Sparkles },
  REVISION: { label: 'En Revisión', color: 'bg-amber-100 text-amber-700', icon: Eye },
  APROBADA: { label: 'Aprobada', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function PropuestasTab({ projectId }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generationConfig, setGenerationConfig] = useState({
    includeTechnical: true,
    includeGantt: true,
    includeBudget: true,
    includeRisks: true,
    tone: 'PROFESIONAL'
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/proposals`) as any;
      setProposals(res.proposals || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiFetch(`/project360/projects/${projectId}/proposals`, {
        method: 'POST',
        json: generationConfig
      });
      setShowGenerateModal(false);
      load();
    } catch (e: any) { alert(e.message); }
    setGenerating(false);
  };

  const handleExport = async (proposalId: string, format: 'pdf' | 'word' | 'excel' | 'ppt') => {
    try {
      const res = await apiFetch(`/project360/proposals/${proposalId}/export?format=${format}`) as any;
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      } else {
        alert('Exportación en desarrollo. URL no disponible.');
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta propuesta?')) return;
    try {
      await apiFetch(`/project360/proposals/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const formatCurrency = (val: number | null) => 
    val ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val) : '-';

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando propuestas...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Generador de Propuestas</h2>
          <p className="text-sm text-gray-500">Creación automática de propuestas técnicas con IA</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" /> 
          {generating ? 'Generando...' : 'Generar Propuesta IA'}
        </button>
      </div>

      {/* Lista de Propuestas */}
      {proposals.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin propuestas generadas</h3>
          <p className="text-gray-500 mb-4">Generá tu primera propuesta técnica con IA</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Generar Propuesta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proposals.map(proposal => {
            const status = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.BORRADOR;
            return (
              <div key={proposal.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.color}`}>
                    <status.icon className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setSelectedProposal(proposal)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(proposal.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{proposal.title || 'Propuesta sin título'}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                  {proposal.iaModelUsed && (
                    <span className="text-xs text-gray-500">IA: {proposal.iaModelUsed}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Costo Est.</div>
                    <div className="font-semibold">{formatCurrency(proposal.costEstimate)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Margen Est.</div>
                    <div className="font-semibold text-emerald-600">{proposal.marginEstimate ? `${proposal.marginEstimate}%` : '-'}</div>
                  </div>
                </div>

                {proposal.generatedAt && (
                  <div className="text-xs text-gray-500 mb-3">
                    Generada: {new Date(proposal.generatedAt).toLocaleDateString()}
                  </div>
                )}

                {/* Export Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleExport(proposal.id, 'pdf')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100"
                  >
                    <FileText className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    onClick={() => handleExport(proposal.id, 'word')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100"
                  >
                    <FileCode className="w-3 h-3" /> Word
                  </button>
                  <button 
                    onClick={() => handleExport(proposal.id, 'excel')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> Excel
                  </button>
                  <button 
                    onClick={() => handleExport(proposal.id, 'ppt')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded text-xs font-medium hover:bg-orange-100"
                  >
                    <Presentation className="w-3 h-3" /> PPT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Generar */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" /> Generar Propuesta con IA
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              La IA analizará el proyecto, el business case, el dimensionamiento operativo y generará una propuesta técnica completa.
            </p>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={generationConfig.includeTechnical}
                  onChange={e => setGenerationConfig({...generationConfig, includeTechnical: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm">Incluir propuesta técnica detallada</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={generationConfig.includeGantt}
                  onChange={e => setGenerationConfig({...generationConfig, includeGantt: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm">Incluir cronograma (Gantt)</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={generationConfig.includeBudget}
                  onChange={e => setGenerationConfig({...generationConfig, includeBudget: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm">Incluir presupuesto preliminar</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={generationConfig.includeRisks}
                  onChange={e => setGenerationConfig({...generationConfig, includeRisks: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm">Incluir análisis de riesgos</span>
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">Tono de la propuesta</label>
                <select 
                  value={generationConfig.tone}
                  onChange={e => setGenerationConfig({...generationConfig, tone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="PROFESIONAL">Profesional Corporativo</option>
                  <option value="TECNICO">Técnico Detallado</option>
                  <option value="EJECUTIVO">Ejecutivo Conciso</option>
                  <option value="COMERCIAL">Comercial Persuasivo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleGenerate} 
                disabled={generating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? <><Clock className="w-4 h-4 animate-spin" /> Generando...</> : <><Sparkles className="w-4 h-4" /> Generar</>}
              </button>
              <button 
                onClick={() => setShowGenerateModal(false)} 
                disabled={generating}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{selectedProposal.title || 'Detalle de Propuesta'}</h3>
              <button 
                onClick={() => setSelectedProposal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {selectedProposal.executiveSummary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Resumen Ejecutivo</h4>
                  <p className="text-sm text-blue-800">{selectedProposal.executiveSummary}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {selectedProposal.technicalProposal && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Propuesta Técnica</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{selectedProposal.technicalProposal}</p>
                  </div>
                )}
                {selectedProposal.operationalScope && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Alcance Operativo</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{selectedProposal.operationalScope}</p>
                  </div>
                )}
              </div>

              {selectedProposal.risks && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Riesgos Identificados</h4>
                  <p className="text-sm text-amber-800">{selectedProposal.risks}</p>
                </div>
              )}

              {selectedProposal.exclusions && (
                <div className="bg-gray-100 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Exclusiones</h4>
                  <p className="text-sm text-gray-700">{selectedProposal.exclusions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
