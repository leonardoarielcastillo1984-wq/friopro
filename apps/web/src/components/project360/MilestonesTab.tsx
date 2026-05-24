'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, Clock, Calendar } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function MilestonesTab({ projectId }: Props) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', description: '', targetDate: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/milestones`) as any;
      setMilestones(res.milestones || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!newMilestone.name || !newMilestone.targetDate) return;
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/milestones`, { method: 'POST', json: newMilestone }) as any;
      setMilestones([...milestones, res.milestone].sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()));
      setNewMilestone({ name: '', description: '', targetDate: '' });
      setShowAdd(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar hito?')) return;
    await apiFetch(`/project360/milestones/${id}`, { method: 'DELETE' });
    setMilestones(milestones.filter(m => m.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando hitos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Hitos / Timeline</h2>
          <p className="text-sm text-gray-500">Seguimiento de milestones del proyecto</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Agregar Hito
        </button>
      </div>

      {milestones.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin hitos definidos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-6">
          <div className="relative border-l-2 border-blue-200 ml-3 space-y-6">
            {milestones.sort((a: any, b: any) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()).map((m: any) => (
              <div key={m.id} className="ml-6 relative">
                <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 ${m.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : 'bg-white border-blue-400'}`} />
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <button onClick={() => handleDelete(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">{new Date(m.targetDate).toLocaleDateString()} • {m.status === 'COMPLETED' ? '✓ Completado' : 'Pendiente'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold">Nuevo Hito</h3>
            <input type="text" value={newMilestone.name} onChange={e => setNewMilestone({ ...newMilestone, name: e.target.value })} placeholder="Nombre del hito" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="text" value={newMilestone.description} onChange={e => setNewMilestone({ ...newMilestone, description: e.target.value })} placeholder="Descripción" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="date" value={newMilestone.targetDate} onChange={e => setNewMilestone({ ...newMilestone, targetDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-3 pt-2">
              <button onClick={handleAdd} disabled={!newMilestone.name || !newMilestone.targetDate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Agregar</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
