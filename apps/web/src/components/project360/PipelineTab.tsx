'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Filter, Plus, Save, Trash2, ChevronRight, ChevronLeft,
  User, Calendar, DollarSign, Percent, AlertCircle, CheckCircle2, XCircle,
  Target, Users, FileText, Phone, Mail
} from 'lucide-react';

interface PipelineStage {
  id: string;
  stage: string;
  stageOrder: number;
  entryDate: string;
  exitDate: string | null;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  probability: number | null;
  pipelineValue: number | null;
  weightedValue: number | null;
  notes: string | null;
  nextActions: string | null;
  decisionMakers: string | null;
  competitors: any | null;
  relatedQuoteIds: string[] | null;
  decisionReason: string | null;
  isCurrent: boolean;
  // CRM fields
  visitsCount: number;
  meetingsCount: number;
  lastContactDate: string | null;
  contactIds: string[] | null;
  clientId: string | null;
  relatedMinutaIds: string[] | null;
  relatedEmailIds: string[] | null;
  ourAdvantage: string | null;
  ourWeakness: string | null;
}

interface Props {
  projectId: string;
}

const PIPELINE_STAGES = [
  { key: 'LEAD', label: 'Lead', color: 'bg-gray-100 text-gray-700', icon: Target },
  { key: 'OPORTUNIDAD', label: 'Oportunidad', color: 'bg-blue-100 text-blue-700', icon: Filter },
  { key: 'ANALISIS', label: 'Análisis', color: 'bg-purple-100 text-purple-700', icon: FileText },
  { key: 'VISITA_TECNICA', label: 'Visita Técnica', color: 'bg-amber-100 text-amber-700', icon: Users },
  { key: 'PROPUESTA', label: 'Propuesta', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  { key: 'NEGOCIACION', label: 'Negociación', color: 'bg-orange-100 text-orange-700', icon: DollarSign },
  { key: 'ADJUDICADO', label: 'Adjudicado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  { key: 'PERDIDO', label: 'Perdido', color: 'bg-red-100 text-red-700', icon: XCircle },
];

export default function PipelineTab({ projectId }: Props) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [newStage, setNewStage] = useState({
    stage: 'LEAD', probability: '', pipelineValue: '',
    expectedCloseDate: '', notes: '', nextActions: '',
    decisionMakers: '', competitors: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/pipeline`) as any;
      setStages(res.pipeline || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const currentStage = stages.find(s => s.isCurrent);
  const currentStageConfig = PIPELINE_STAGES.find(s => s.key === currentStage?.stage);
  const totalPipeline = stages.reduce((sum, s) => sum + (s.pipelineValue || 0), 0);
  const totalWeighted = stages.reduce((sum, s) => sum + (s.weightedValue || 0), 0);

  const handleAdd = async () => {
    try {
      await apiFetch(`/project360/projects/${projectId}/pipeline`, {
        method: 'POST',
        json: {
          stage: newStage.stage,
          probability: Number(newStage.probability) || 0,
          pipelineValue: Number(newStage.pipelineValue) || 0,
          expectedCloseDate: newStage.expectedCloseDate || null,
          notes: newStage.notes || null,
          nextActions: newStage.nextActions || null,
          decisionMakers: newStage.decisionMakers || null,
          competitors: newStage.competitors || null,
        }
      });
      setShowAddModal(false);
      setNewStage({ stage: 'LEAD', probability: '', pipelineValue: '', expectedCloseDate: '', notes: '', nextActions: '', decisionMakers: '', competitors: '' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdate = async () => {
    if (!editingStage) return;
    try {
      await apiFetch(`/project360/pipeline/${editingStage.id}`, {
        method: 'PUT',
        json: {
          probability: editingStage.probability,
          pipelineValue: editingStage.pipelineValue,
          expectedCloseDate: editingStage.expectedCloseDate,
          actualCloseDate: editingStage.actualCloseDate,
          notes: editingStage.notes,
          nextActions: editingStage.nextActions,
          decisionMakers: editingStage.decisionMakers,
          competitors: typeof editingStage.competitors === 'string' ? editingStage.competitors : JSON.stringify(editingStage.competitors || []),
          decisionReason: editingStage.decisionReason,
          visitsCount: editingStage.visitsCount,
          meetingsCount: editingStage.meetingsCount,
          lastContactDate: editingStage.lastContactDate,
          ourAdvantage: editingStage.ourAdvantage,
          ourWeakness: editingStage.ourWeakness,
        }
      });
      setEditingStage(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const formatCurrency = (val: number | null) => 
    val ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val) : '-';

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando pipeline...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pipeline Comercial</h2>
          <p className="text-sm text-gray-500">Gestión de etapas de venta y oportunidades</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Avanzar Etapa
        </button>
      </div>

      {/* Funnel Visual */}
      <div className="grid grid-cols-8 gap-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const stageData = stages.find(s => s.stage === stage.key);
          const isCurrent = stageData?.isCurrent;
          const isPast = stages.some(s => s.stage === stage.key && !s.isCurrent && s.exitDate);
          
          return (
            <div key={stage.key} className={`relative rounded-lg p-3 text-center border-2 transition-all ${
              isCurrent ? 'border-blue-500 bg-blue-50 shadow-md' : 
              isPast ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 bg-gray-50'
            }`}>
              <stage.icon className={`w-5 h-5 mx-auto mb-1 ${isCurrent ? 'text-blue-600' : isPast ? 'text-emerald-600' : 'text-gray-400'}`} />
              <div className="text-xs font-medium text-gray-700">{stage.label}</div>
              {stageData && (
                <div className="mt-1 text-xs font-semibold text-gray-900">
                  {stageData.probability}%
                </div>
              )}
              {isCurrent && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
            </div>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">Valor Pipeline</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalPipeline)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">Pipeline Ponderado</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalWeighted)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500 mb-1">Probabilidad Actual</div>
          <div className="text-2xl font-bold text-emerald-600">{currentStage?.probability || 0}%</div>
        </div>
      </div>

      {/* Etapa Actual Detalle */}
      {currentStage && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${currentStageConfig?.color}`}>
              {currentStageConfig && <currentStageConfig.icon className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Etapa Actual: {currentStageConfig?.label}</h3>
              <p className="text-sm text-gray-500">Ingresó: {new Date(currentStage.entryDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor Pipeline</label>
              <div className="text-lg font-semibold">{formatCurrency(currentStage.pipelineValue)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Probabilidad</label>
              <div className="text-lg font-semibold">{currentStage.probability}%</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cierre Esperado</label>
              <div className="text-lg font-semibold">{currentStage.expectedCloseDate ? new Date(currentStage.expectedCloseDate).toLocaleDateString() : '-'}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor Ponderado</label>
              <div className="text-lg font-semibold text-blue-600">{formatCurrency(currentStage.weightedValue)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Decision Makers</label>
              <p className="text-sm text-gray-800">{currentStage.decisionMakers || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Competidores</label>
              <p className="text-sm text-gray-800">{currentStage.competitors || '-'}</p>
            </div>
          </div>

          {currentStage.nextActions && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="block text-xs font-medium text-amber-700 mb-1">Próximas Acciones</label>
              <p className="text-sm text-amber-900">{currentStage.nextActions}</p>
            </div>
          )}

          {/* CRM Details */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Visitas</div>
              <div className="text-lg font-semibold text-gray-900">{currentStage.visitsCount || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Reuniones</div>
              <div className="text-lg font-semibold text-gray-900">{currentStage.meetingsCount || 0}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Último Contacto</div>
              <div className="text-sm font-semibold text-gray-900">{currentStage.lastContactDate ? new Date(currentStage.lastContactDate).toLocaleDateString() : '-'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Competidores</div>
              <div className="text-sm font-semibold text-gray-900">{currentStage.competitors ? (typeof currentStage.competitors === 'string' ? currentStage.competitors : JSON.parse(JSON.stringify(currentStage.competitors)).length) : 0}</div>
            </div>
          </div>

          {(currentStage.ourAdvantage || currentStage.ourWeakness) && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {currentStage.ourAdvantage && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-emerald-700 mb-1">Ventaja Competitiva</div>
                  <p className="text-sm text-emerald-900">{currentStage.ourAdvantage}</p>
                </div>
              )}
              {currentStage.ourWeakness && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-red-700 mb-1">Debilidad Competitiva</div>
                  <p className="text-sm text-red-900">{currentStage.ourWeakness}</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setEditingStage(currentStage)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Editar Etapa
          </button>
        </div>
      )}

      {/* Historial de Etapas */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Historial de Etapas</h3>
        </div>
        <div className="divide-y">
          {stages.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">Sin etapas registradas</div>
          ) : stages.map(stage => {
            const config = PIPELINE_STAGES.find(s => s.key === stage.stage);
            return (
              <div key={stage.id} className={`px-6 py-4 flex items-center justify-between ${stage.isCurrent ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${config?.color || 'bg-gray-100'}`}>
                    {config && <config.icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{config?.label || stage.stage}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(stage.entryDate).toLocaleDateString()}
                      {stage.exitDate && ` → ${new Date(stage.exitDate).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{formatCurrency(stage.pipelineValue)}</span>
                  <span className="font-semibold text-blue-600">{stage.probability}%</span>
                  {!stage.isCurrent && stage.exitDate && (
                    <span className="text-xs text-gray-400">Completada</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Agregar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Avanzar a Nueva Etapa</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva Etapa</label>
                <select 
                  value={newStage.stage} 
                  onChange={e => setNewStage({...newStage, stage: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Probabilidad (%)</label>
                  <input 
                    type="number" min="0" max="100"
                    value={newStage.probability} 
                    onChange={e => setNewStage({...newStage, probability: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Pipeline</label>
                  <input 
                    type="number" 
                    value={newStage.pipelineValue} 
                    onChange={e => setNewStage({...newStage, pipelineValue: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Esperada de Cierre</label>
                <input 
                  type="date" 
                  value={newStage.expectedCloseDate} 
                  onChange={e => setNewStage({...newStage, expectedCloseDate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Decision Makers</label>
                <input 
                  type="text" 
                  value={newStage.decisionMakers} 
                  onChange={e => setNewStage({...newStage, decisionMakers: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: Director de Operaciones, Gerente Comercial"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Competidores</label>
                <input 
                  type="text" 
                  value={newStage.competitors} 
                  onChange={e => setNewStage({...newStage, competitors: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: Competidor A, Competidor B"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Próximas Acciones</label>
                <textarea 
                  value={newStage.nextActions} 
                  onChange={e => setNewStage({...newStage, nextActions: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                  placeholder="Ej: Enviar propuesta técnica, coordinar reunión"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea 
                  value={newStage.notes} 
                  onChange={e => setNewStage({...newStage, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Avanzar Etapa
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editingStage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Etapa</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Probabilidad (%)</label>
                  <input 
                    type="number" min="0" max="100"
                    value={editingStage.probability || ''} 
                    onChange={e => setEditingStage({...editingStage, probability: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Pipeline</label>
                  <input 
                    type="number" 
                    value={editingStage.pipelineValue || ''} 
                    onChange={e => setEditingStage({...editingStage, pipelineValue: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Esperada Cierre</label>
                  <input 
                    type="date" 
                    value={editingStage.expectedCloseDate?.split('T')[0] || ''} 
                    onChange={e => setEditingStage({...editingStage, expectedCloseDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Cierre Real</label>
                  <input 
                    type="date" 
                    value={editingStage.actualCloseDate?.split('T')[0] || ''} 
                    onChange={e => setEditingStage({...editingStage, actualCloseDate: e.target.value || null})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Próximas Acciones</label>
                <textarea 
                  value={editingStage.nextActions || ''} 
                  onChange={e => setEditingStage({...editingStage, nextActions: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo de Decisión (si es ADJUDICADO/PERDIDO)</label>
                <input
                  type="text"
                  value={editingStage.decisionReason || ''}
                  onChange={e => setEditingStage({...editingStage, decisionReason: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: Mejor precio, calidad técnica superior"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Visitas Realizadas</label>
                  <input
                    type="number" min={0}
                    value={editingStage.visitsCount || 0}
                    onChange={e => setEditingStage({...editingStage, visitsCount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reuniones Realizadas</label>
                  <input
                    type="number" min={0}
                    value={editingStage.meetingsCount || 0}
                    onChange={e => setEditingStage({...editingStage, meetingsCount: Number(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Último Contacto</label>
                <input
                  type="date"
                  value={editingStage.lastContactDate?.split('T')[0] || ''}
                  onChange={e => setEditingStage({...editingStage, lastContactDate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ventaja Competitiva</label>
                <textarea
                  value={editingStage.ourAdvantage || ''}
                  onChange={e => setEditingStage({...editingStage, ourAdvantage: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                  placeholder="Ej: Mejor precio, experiencia comprobada..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Debilidad Competitiva</label>
                <textarea
                  value={editingStage.ourWeakness || ''}
                  onChange={e => setEditingStage({...editingStage, ourWeakness: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                  placeholder="Ej: Menor presencia regional..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleUpdate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Guardar Cambios
              </button>
              <button onClick={() => setEditingStage(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
