'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft, Activity, Users, FileCheck, Brain, AlertTriangle,
  Plus, Trash2, Play, Save, X, Loader2
} from 'lucide-react';

export default function DrillManagePage() {
  const params = useParams();
  const router = useRouter();
  const drillId = params.id as string;

  const [drill, setDrill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'results' | 'actions' | 'participants' | 'ai' | 'alerts'>('results');
  const [items, setItems] = useState<any[]>([]);
  const [aiText, setAiText] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Form states
  const [newResult, setNewResult] = useState({ result: 'SATISFACTORY', responseTime: '', observations: '', deviationsDetected: false });
  const [newAction, setNewAction] = useState({ description: '', responsibleId: '', dueDate: '', status: 'PENDING' });
  const [newParticipant, setNewParticipant] = useState({ employeeId: '' });
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => { loadDrill(); }, [drillId]);
  useEffect(() => {
    apiFetch('/hr/employees').then((data: any) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);
  useEffect(() => { loadTab(); }, [activeTab, drillId]);

  const loadDrill = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/emergency/drills/${drillId}`);
      setDrill(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadTab = async () => {
    if (!drillId) return;
    setTabLoading(true);
    try {
      if (activeTab === 'results') {
        const data = await apiFetch(`/emergency/drills/${drillId}/results`) as any;
        setItems(data.items || []);
      } else if (activeTab === 'actions') {
        const data = await apiFetch(`/emergency/drills/${drillId}/actions`) as any;
        setItems(data.items || []);
      } else if (activeTab === 'participants') {
        const data = await apiFetch(`/emergency/drills/${drillId}/participants`) as any;
        setItems(data.items || []);
      } else if (activeTab === 'ai') {
        const data = await apiFetch(`/emergency/drills/${drillId}/ai-analyze`, { method: 'POST' }) as any;
        setAiText(data.analysis || '');
      } else if (activeTab === 'alerts') {
        const data = await apiFetch(`/emergency/drills/alerts/summary`) as any;
        setAlerts((data.alerts || []).filter((a: any) => a.drillId === drillId));
      }
    } catch (e) { console.error(e); }
    setTabLoading(false);
  };

  const addResult = async () => {
    await apiFetch(`/emergency/drills/${drillId}/results`, {
      method: 'POST',
      json: newResult
    });
    setNewResult({ result: 'SATISFACTORY', responseTime: '', observations: '', deviationsDetected: false });
    loadTab();
  };

  const deleteResult = async (id: string) => {
    if (!confirm('¿Eliminar resultado?')) return;
    await apiFetch(`/emergency/drills/${drillId}/results/${id}`, { method: 'DELETE' });
    loadTab();
  };

  const addAction = async () => {
    await apiFetch(`/emergency/drills/${drillId}/actions`, {
      method: 'POST',
      json: newAction
    });
    setNewAction({ description: '', responsibleId: '', dueDate: '', status: 'PENDING' });
    loadTab();
  };

  const deleteAction = async (id: string) => {
    if (!confirm('¿Eliminar acción?')) return;
    await apiFetch(`/emergency/drills/${drillId}/actions/${id}`, { method: 'DELETE' });
    loadTab();
  };

  const addParticipant = async () => {
    await apiFetch(`/emergency/drills/${drillId}/participants`, {
      method: 'POST',
      json: newParticipant
    });
    setNewParticipant({ employeeId: '' });
    loadTab();
  };

  const deleteParticipant = async (id: string) => {
    if (!confirm('¿Eliminar participante?')) return;
    await apiFetch(`/emergency/drills/${drillId}/participants/${id}`, { method: 'DELETE' });
    loadTab();
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;
  if (!drill) return <div className="p-6">Simulacro no encontrado</div>;

  const tabs = [
    { id: 'results', label: 'Resultados', icon: FileCheck },
    { id: 'actions', label: 'Acciones', icon: Activity },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'ai', label: 'IA', icon: Brain },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/simulacros`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <h1 className="text-2xl font-bold">{drill.name} - Gestionar</h1>
      </div>

      <div className="flex gap-2 border-b mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tabLoading && <div className="p-4"><Loader2 className="animate-spin w-5 h-5" /></div>}

      {!tabLoading && activeTab === 'results' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Nuevo Resultado</h3>
            <div className="grid grid-cols-3 gap-3">
              <select value={newResult.result} onChange={(e) => setNewResult({...newResult, result: e.target.value})} className="border rounded px-3 py-2">
                <option value="SATISFACTORY">Satisfactorio</option>
                <option value="WITH_FAILURES">Con Fallas</option>
                <option value="CRITICAL">Critico</option>
              </select>
              <input type="number" placeholder="Tiempo resp (min)" value={newResult.responseTime} onChange={(e) => setNewResult({...newResult, responseTime: e.target.value})} className="border rounded px-3 py-2" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newResult.deviationsDetected} onChange={(e) => setNewResult({...newResult, deviationsDetected: e.target.checked})} />
                Desviaciones detectadas
              </label>
            </div>
            <textarea placeholder="Observaciones" value={newResult.observations} onChange={(e) => setNewResult({...newResult, observations: e.target.value})} className="w-full border rounded px-3 py-2 mt-2" />
            <button onClick={addResult} className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {items.length === 0 && <p className="text-gray-500">Sin resultados</p>}
          {items.map((item: any) => (
            <div key={item.id} className="bg-white border rounded-lg p-4 flex justify-between items-start">
              <div>
                <div className="font-medium">{item.result === 'SATISFACTORY' ? 'Satisfactorio' : item.result === 'WITH_FAILURES' ? 'Con Fallas' : item.result === 'CRITICAL' ? 'Crítico' : item.result}</div>
                <div className="text-sm text-gray-600">{item.observations}</div>
                {item.responseTime && <div className="text-sm text-gray-500">Tiempo: {item.responseTime} min</div>}
              </div>
              <button onClick={() => deleteResult(item.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {!tabLoading && activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Nueva Acción</h3>
            <input placeholder="Descripción" value={newAction.description} onChange={(e) => setNewAction({...newAction, description: e.target.value})} className="w-full border rounded px-3 py-2 mb-2" />
            <div className="grid grid-cols-3 gap-3">
              <select value={newAction.responsibleId} onChange={(e) => setNewAction({...newAction, responsibleId: e.target.value})} className="border rounded px-3 py-2">
                <option value="">Sin responsable</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
              <input type="date" placeholder="Fecha limite" value={newAction.dueDate} onChange={(e) => setNewAction({...newAction, dueDate: e.target.value})} className="border rounded px-3 py-2" />
              <select value={newAction.status} onChange={(e) => setNewAction({...newAction, status: e.target.value})} className="border rounded px-3 py-2">
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <button onClick={addAction} className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {items.length === 0 && <p className="text-gray-500">Sin acciones</p>}
          {items.map((item: any) => (
            <div key={item.id} className="bg-white border rounded-lg p-4 flex justify-between items-start">
              <div>
                <div className="font-medium">{item.description}</div>
                <div className="text-sm text-gray-600">Estado: {item.status === 'PENDING' ? 'Pendiente' : item.status === 'IN_PROGRESS' ? 'En Progreso' : item.status === 'COMPLETED' ? 'Completado' : item.status === 'CANCELLED' ? 'Cancelado' : item.status}</div>
                {item.dueDate && <div className="text-sm text-gray-500">Vence: {new Date(item.dueDate).toLocaleDateString()}</div>}
              </div>
              <button onClick={() => deleteAction(item.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {!tabLoading && activeTab === 'participants' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Agregar Participante</h3>
            <select value={newParticipant.employeeId} onChange={(e) => setNewParticipant({...newParticipant, employeeId: e.target.value})} className="border rounded px-3 py-2 mr-2">
              <option value="">Seleccionar empleado</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
            <button onClick={addParticipant} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              <Plus className="w-4 h-4 inline" /> Agregar
            </button>
          </div>
          {items.length === 0 && <p className="text-gray-500">Sin participantes</p>}
          {items.map((item: any) => (
            <div key={item.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
              <div>{item.employee?.firstName} {item.employee?.lastName} <span className="text-gray-500 text-sm">({item.employee?.email})</span></div>
              <button onClick={() => deleteParticipant(item.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {!tabLoading && activeTab === 'ai' && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Análisis IA</h3>
          {aiText ? <pre className="whitespace-pre-wrap text-sm">{aiText}</pre> : <p className="text-gray-500">Sin análisis</p>}
        </div>
      )}

      {!tabLoading && activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 && <p className="text-gray-500">Sin alertas activas</p>}
          {alerts.map((alert: any, i: number) => (
            <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="font-semibold text-yellow-800">{alert.drillName}</div>
              <ul className="list-disc ml-5 mt-1 text-sm text-yellow-700">
                {alert.flags.map((f: string, j: number) => <li key={j}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
