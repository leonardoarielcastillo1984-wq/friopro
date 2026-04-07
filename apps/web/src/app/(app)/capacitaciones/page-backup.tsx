'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Training, TrainingStats } from '@/lib/types';
import {
  BookOpen, Calendar, Users, Clock, Plus, Search,
  CheckCircle2, PlayCircle, XCircle, Filter, X,
  MapPin, User, GraduationCap,
} from 'lucide-react';

const CATEGORIES = [
  'Seguridad', 'Calidad', 'Ambiente', 'Seguridad Vial',
  'Normativo', 'Técnico', 'Liderazgo', 'Primeros Auxilios',
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SCHEDULED: { label: 'Programada', color: 'bg-blue-100 text-blue-700', icon: <Calendar className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En curso', color: 'bg-yellow-100 text-yellow-700', icon: <PlayCircle className="h-3 w-3" /> },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
};

const MODALITY_MAP: Record<string, string> = {
  PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta', E_LEARNING: 'E-Learning',
};

export default function CapacitacionesPage() {
  const router = useRouter();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', category: 'Seguridad',
    modality: 'PRESENCIAL', instructor: '', location: '',
    durationHours: '1', scheduledDate: '', expectedParticipants: '10',
    standard: '',
  });

  const fetchData = () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : '';
    Promise.all([
      apiFetch<{ trainings: Training[] }>(`/trainings${params}`),
      apiFetch<{ stats: TrainingStats }>('/trainings/stats'),
    ])
      .then(([t, s]) => { setTrainings(t.trainings); setStats(s.stats); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filterStatus]);

  const handleCreate = async () => {
    if (!form.title || !form.category) return;
    setCreating(true);
    try {
      await apiFetch('/trainings', {
        method: 'POST',
        json: {
          title: form.title,
          description: form.description || undefined,
          category: form.category,
          modality: form.modality,
          instructor: form.instructor || undefined,
          location: form.location || undefined,
          durationHours: parseFloat(form.durationHours) || 1,
          scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : undefined,
          expectedParticipants: parseInt(form.expectedParticipants) || 0,
          standard: form.standard || undefined,
        },
      });
      setForm({ title: '', description: '', category: 'Seguridad', modality: 'PRESENCIAL', instructor: '', location: '', durationHours: '1', scheduledDate: '', expectedParticipants: '10', standard: '' });
      setShowForm(false);
      fetchData();
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Capacitaciones</h1>
          <p className="text-slate-500 mt-1">Plan de formación y registro de capacitaciones</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" /> Nueva Capacitación
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center justify-between">
          {error} <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard icon={<BookOpen className="h-5 w-5 text-blue-600" />} label="Total" value={stats.total} bg="bg-blue-50" />
          <StatCard icon={<Calendar className="h-5 w-5 text-indigo-600" />} label="Programadas" value={stats.scheduled} bg="bg-indigo-50" />
          <StatCard icon={<PlayCircle className="h-5 w-5 text-yellow-600" />} label="En Curso" value={stats.inProgress} bg="bg-yellow-50" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Completadas" value={stats.completed} bg="bg-green-50" />
          <StatCard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Horas Totales" value={stats.totalHours} bg="bg-purple-50" />
          <StatCard icon={<Users className="h-5 w-5 text-teal-600" />} label="Participantes" value={stats.totalParticipants} bg="bg-teal-50" />
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Buscar capacitaciones..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">Nueva Capacitación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input placeholder="Título *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {Object.entries(MODALITY_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Instructor" value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Ubicación" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" placeholder="Duración (horas)" value={form.durationHours} onChange={e => setForm({ ...form, durationHours: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="datetime-local" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input type="number" placeholder="Participantes esperados" value={form.expectedParticipants} onChange={e => setForm({ ...form, expectedParticipants: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Norma relacionada (opcional)" value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !form.title} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
              {creating ? 'Creando...' : 'Crear Capacitación'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Training List */}
      {(() => {
        const q = searchTerm.toLowerCase();
        const filtered = q ? trainings.filter(t => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.instructor && t.instructor.toLowerCase().includes(q))) : trainings;
        return filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-2">Aún no hay capacitaciones registradas</p>
          <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm hover:underline">Programar primera capacitación</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.SCHEDULED;
            return (
              <div key={t.id} onClick={() => router.push(`/capacitaciones/${t.id}`)} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">{t.code}</p>
                    <h3 className="font-semibold text-slate-900 mt-1">{t.title}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${st.color}`}>
                    {st.icon}{st.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.category}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{MODALITY_MAP[t.modality] || t.modality}</span>
                  {t.standard && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t.standard}</span>}
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  {t.instructor && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {t.instructor}
                    </div>
                  )}
                  {t.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {t.location}
                    </div>
                  )}
                  {t.scheduledDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(t.scheduledDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.durationHours}h</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t._count?.attendees ?? 0}/{t.expectedParticipants}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
      })()}
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-slate-200`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
