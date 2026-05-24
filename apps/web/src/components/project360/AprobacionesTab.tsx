'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Shield, Check, X, ArrowRight, Plus } from 'lucide-react';

const PIPELINE_ETAPAS = [
  'DIMENSIONADO', 'COTIZADO', 'APROBADO_PARA_PRESENTAR', 'ADJUDICADO', 'EN_EJECUCION', 'CERRADO'
];

interface Props {
  projectId: string;
}

export default function AprobacionesTab({ projectId }: Props) {
  const [aprobaciones, setAprobaciones] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [etapaDestino, setEtapaDestino] = useState('');
  const [showAvanzar, setShowAvanzar] = useState(false);
  const [nueva, setNueva] = useState({ etapa: '', aprobadorId: '', comentarios: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, eRes] = await Promise.all([
        apiFetch(`/project360/projects/${projectId}/aprobaciones`) as any,
        apiFetch('/project360/members') as any,
      ]);
      setAprobaciones(aRes.aprobaciones || []);
      setEmpleados(eRes.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleSolicitar = async () => {
    if (!nueva.etapa || !nueva.aprobadorId) { alert('Seleccioná etapa y aprobador'); return; }
    try {
      await apiFetch(`/project360/projects/${projectId}/aprobaciones`, { method: 'POST', json: nueva }) as any;
      setShowAdd(false);
      setNueva({ etapa: '', aprobadorId: '', comentarios: '' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleAprobar = async (id: string) => {
    try {
      await apiFetch(`/project360/aprobaciones/${id}/aprobar`, { method: 'POST', json: {} }) as any;
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleRechazar = async (id: string) => {
    const comentarios = prompt('Motivo del rechazo:');
    if (!comentarios) return;
    try {
      await apiFetch(`/project360/aprobaciones/${id}/rechazar`, { method: 'POST', json: { comentarios } }) as any;
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleAvanzarEtapa = async () => {
    if (!etapaDestino) return;
    try {
      await apiFetch(`/project360/projects/${projectId}/avanzar`, { method: 'POST', json: { nuevaEtapa: etapaDestino } }) as any;
      setShowAvanzar(false); setEtapaDestino(''); load();
    } catch (e: any) { alert(e.message); }
  };

  const getEstadoColor = (estado: string) => {
    const m: Record<string, string> = {
      PENDIENTE: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      APROBADO: 'bg-green-50 border-green-200 text-green-800',
      RECHAZADO: 'bg-red-50 border-red-200 text-red-800',
    };
    return m[estado] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando aprobaciones...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield className="w-5 h-5 text-amber-600" /> Workflow de Aprobaciones</h2>
          <p className="text-sm text-gray-500">Gestión de etapas y aprobadores del proyecto</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAvanzar(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <ArrowRight className="w-4 h-4" /> Avanzar Etapa
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Solicitar Aprobación
          </button>
        </div>
      </div>

      {/* Etapas Pipeline */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between">
          {PIPELINE_ETAPAS.map((etapa, i) => (
            <div key={etapa} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i <= aprobaciones.filter((a: any) => a.estado === 'APROBADO').length ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i + 1}
              </div>
              {i < PIPELINE_ETAPAS.length - 1 && <div className="flex-1 h-0.5 mx-2 bg-gray-200" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          {PIPELINE_ETAPAS.map(e => <span key={e}>{e.replace(/_/g, ' ')}</span>)}
        </div>
      </div>

      {/* Lista */}
      {aprobaciones.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin solicitudes de aprobación registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aprobaciones.map((a: any) => (
            <div key={a.id} className={`p-4 rounded-xl border ${getEstadoColor(a.estado)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">Etapa: {a.etapa.replace(/_/g, ' ')}</p>
                  <p className="text-xs mt-1">Solicitante: {a.solicitante?.name || a.solicitante?.email} • {new Date(a.createdAt).toLocaleDateString()}</p>
                  {a.comentarios && <p className="text-xs mt-1 opacity-80">{a.comentarios}</p>}
                </div>
                {a.estado === 'PENDIENTE' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAprobar(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"><Check className="w-3 h-3" /> Aprobar</button>
                    <button onClick={() => handleRechazar(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700"><X className="w-3 h-3" /> Rechazar</button>
                  </div>
                )}
                {a.estado === 'APROBADO' && <span className="text-xs font-medium text-green-700 flex items-center gap-1"><Check className="w-3 h-3" /> Aprobado</span>}
                {a.estado === 'RECHAZADO' && <span className="text-xs font-medium text-red-700 flex items-center gap-1"><X className="w-3 h-3" /> Rechazado</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Solicitar */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold">Solicitar Aprobación</h3>
            <select value={nueva.etapa} onChange={e => setNueva({ ...nueva, etapa: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Seleccionar etapa...</option>
              {PIPELINE_ETAPAS.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={nueva.aprobadorId} onChange={e => setNueva({ ...nueva, aprobadorId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Seleccionar aprobador...</option>
              {empleados.map((e: any) => <option key={e.id} value={e.id}>{e.name || e.email}</option>)}
            </select>
            <textarea value={nueva.comentarios} onChange={e => setNueva({ ...nueva, comentarios: e.target.value })} placeholder="Comentarios (opcional)" className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
            <div className="flex gap-3 pt-2">
              <button onClick={handleSolicitar} disabled={!nueva.etapa || !nueva.aprobadorId} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm disabled:opacity-50">Solicitar</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Avanzar */}
      {showAvanzar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold">Avanzar Etapa del Negocio</h3>
            <select value={etapaDestino} onChange={e => setEtapaDestino(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Seleccionar nueva etapa...</option>
              {PIPELINE_ETAPAS.map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="flex gap-3 pt-2">
              <button onClick={handleAvanzarEtapa} disabled={!etapaDestino} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Avanzar</button>
              <button onClick={() => setShowAvanzar(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
