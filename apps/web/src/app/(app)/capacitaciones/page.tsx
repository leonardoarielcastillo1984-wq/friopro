'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Training, TrainingStats } from '@/lib/types';
import {
  BookOpen, Calendar, Users, Clock, Plus, Search,
  CheckCircle2, PlayCircle, XCircle, Filter, X,
  MapPin, User, GraduationCap, ChevronDown,
  Target, FileText, TrendingUp, Link as LinkIcon,
  Star, Award, BarChart3, AlertTriangle, Download
} from 'lucide-react';
import { exportTrainingsToExcel } from '@/lib/exportToExcel';

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

const categoryColors: Record<string, string> = {
  'Seguridad': 'bg-red-100 text-red-700 border-red-200',
  'Calidad': 'bg-blue-100 text-blue-700 border-blue-200',
  'Ambiente': 'bg-green-100 text-green-700 border-green-200',
  'Seguridad Vial': 'bg-orange-100 text-orange-700 border-orange-200',
  'Normativo': 'bg-purple-100 text-purple-700 border-purple-200',
  'Técnico': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Liderazgo': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Primeros Auxilios': 'bg-pink-100 text-pink-700 border-pink-200',
};

const DEFAULT_TRAINING_STATS: TrainingStats = {
  total: 0,
  scheduled: 0,
  inProgress: 0,
  completed: 0,
  totalHours: 0,
  totalParticipants: 0,
  categories: {},
};

export default function CapacitacionesPage() {
  const router = useRouter();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [stats, setStats] = useState<TrainingStats>(DEFAULT_TRAINING_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'dashboard' | 'report'>('list');

  const [form, setForm] = useState({
    title: '', description: '', category: 'Seguridad',
    modality: 'PRESENCIAL', instructor: '', location: '',
    durationHours: '1', scheduledDate: '', expectedParticipants: '10',
    standard: '',
    objectives: '', contentProgram: '', methodologyDetails: '',
    evaluationCriteria: '', materialUrl: '',
  });

  const fetchData = () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : '';
    Promise.all([
      apiFetch<{ trainings: Training[] }>(`/trainings${params}`),
      apiFetch<{ stats: TrainingStats }>('/trainings/stats'),
    ])
      .then(([t, s]) => {
        setTrainings(t?.trainings ?? []);
        setStats(s?.stats ?? DEFAULT_TRAINING_STATS);
        setError('');
      })
      .catch(() => {
        setTrainings([]);
        setStats(DEFAULT_TRAINING_STATS);
        setError('');
      })
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
          objectives: form.objectives || undefined,
          contentProgram: form.contentProgram || undefined,
          methodologyDetails: form.methodologyDetails || undefined,
          evaluationCriteria: form.evaluationCriteria || undefined,
          materialUrl: form.materialUrl || undefined,
        },
      });
      setForm({ title: '', description: '', category: 'Seguridad', modality: 'PRESENCIAL', instructor: '', location: '', durationHours: '1', scheduledDate: '', expectedParticipants: '10', standard: '', objectives: '', contentProgram: '', methodologyDetails: '', evaluationCriteria: '', materialUrl: '' });
      setShowForm(false);
      fetchData();
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false, trainings: [] });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayTrainings = trainings.filter(t => {
        if (!t.scheduledDate) return false;
        const trainingDate = new Date(t.scheduledDate);
        return trainingDate.getDate() === i && trainingDate.getMonth() === month && trainingDate.getFullYear() === year;
      });
      days.push({ date, isCurrentMonth: true, trainings: dayTrainings });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, trainings: [] });
    }
    return days;
  };

  const formatMonth = (date: Date) => date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentDate = new Date();
  const days = getDaysInMonth(currentDate);
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header with Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Capacitaciones ISO</h1>
          <p className="text-slate-500 mt-1">Gestión de formación conforme ISO 9001:2015 - 7.2 Competencia</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setActiveTab('list')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Lista</button>
            <button onClick={() => setActiveTab('calendar')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Calendario</button>
            <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Dashboard ISO</button>
            <button onClick={() => setActiveTab('report')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'report' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Reporte</button>
          </div>
          <button 
            onClick={() => exportTrainingsToExcel(trainings)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Exportar Excel
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus className="h-4 w-4" /> Nueva
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center justify-between">
          {error} <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create Form - Global */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Nueva Capacitación ISO 9001:2015</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Requisito 7.2 Competencia</span>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
          </div>
          
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
          
          {/* ISO Fields */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-blue-600" /> Definición de Competencia (ISO 9001:2015 - 7.2)</h4>
            <div className="space-y-3">
              <textarea placeholder="Objetivos de aprendizaje *" value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
              <textarea placeholder="Contenido programático *" value={form.contentProgram} onChange={e => setForm({ ...form, contentProgram: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
              <textarea placeholder="Metodología detallada *" value={form.methodologyDetails} onChange={e => setForm({ ...form, methodologyDetails: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
              <textarea placeholder="Criterios de evaluación *" value={form.evaluationCriteria} onChange={e => setForm({ ...form, evaluationCriteria: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
            </div>
          </div>
          
          <textarea placeholder="Descripción general (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
          
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !form.title} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
              {creating ? 'Creando...' : 'Crear Capacitación ISO'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* List View */}
      {activeTab === 'list' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard icon={<BookOpen className="h-5 w-5 text-blue-600" />} label="Total" value={stats.total} bg="bg-blue-50" />
            <StatCard icon={<Calendar className="h-5 w-5 text-indigo-600" />} label="Programadas" value={stats.scheduled} bg="bg-indigo-50" />
            <StatCard icon={<PlayCircle className="h-5 w-5 text-yellow-600" />} label="En Curso" value={stats.inProgress} bg="bg-yellow-50" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Completadas" value={stats.completed} bg="bg-green-50" />
            <StatCard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Horas Totales" value={stats.totalHours} bg="bg-purple-50" />
            <StatCard icon={<Users className="h-5 w-5 text-teal-600" />} label="Participantes" value={stats.totalParticipants} bg="bg-teal-50" />
          </div>

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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${st.color}`}>{st.icon}{st.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.category}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{MODALITY_MAP[t.modality] || t.modality}</span>
                        {t.standard && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t.standard}</span>}
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        {t.instructor && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" />{t.instructor}</div>}
                        {t.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" />{t.location}</div>}
                        {t.scheduledDate && <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-400" />{new Date(t.scheduledDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
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
        </>
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 capitalize">{formatMonth(currentDate)}</h2>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button className="px-3 py-1 text-xs font-medium rounded-md bg-white text-slate-900 shadow-sm">Mes</button>
              </div>
              <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                <option value="">Todas las categorías</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                <Plus className="h-3 w-3" /> Nueva
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-200">
            {weekDays.map(day => <div key={day} className="py-2 text-center text-xs font-medium text-slate-500 bg-slate-50">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const isToday = day.date.toDateString() === new Date().toDateString();
              return (
                <div key={idx} className={`min-h-[100px] p-2 border-b border-r border-slate-100 ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50'} ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : day.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>{day.date.getDate()}</div>
                  <div className="space-y-1">
                    {day.trainings.slice(0, 3).map((t, tIdx) => (
                      <div key={tIdx} onClick={() => router.push(`/capacitaciones/${t.id}`)} className={`p-1 rounded cursor-pointer hover:opacity-80 text-xs ${categoryColors[t.category] || 'bg-slate-100 text-slate-700'}`}>
                        <div className="font-medium truncate">{t.title}</div>
                      </div>
                    ))}
                  </div>
                  {day.trainings.length === 0 && (
                    <button onClick={() => setShowForm(true)} className="w-full py-4 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-dashed border-slate-200">+ Agregar</button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => <div key={cat} className="flex items-center gap-1"><div className={`w-3 h-3 rounded ${(categoryColors[cat] || 'bg-slate-100').split(' ')[0]}`} /><span className="text-xs text-slate-600">{cat}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard ISO */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard icon={<BookOpen className="h-5 w-5 text-blue-600" />} label="Total" value={stats.total} bg="bg-blue-50" />
            <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Completadas" value={stats.completed} bg="bg-green-50" />
            <StatCard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Horas Totales" value={stats.totalHours} bg="bg-purple-50" />
            <StatCard icon={<Users className="h-5 w-5 text-teal-600" />} label="Participantes" value={stats.totalParticipants} bg="bg-teal-50" />
            <StatCard icon={<Star className="h-5 w-5 text-yellow-600" />} label="Satisfacción" value={0} bg="bg-yellow-50" suffix="/5" />
            <StatCard icon={<Award className="h-5 w-5 text-indigo-600" />} label="Efectividad" value={0} bg="bg-indigo-50" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-blue-600" /> Indicadores de Cumplimiento ISO 9001:2015</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ComplianceIndicator label="Con Objetivos" value={0} total={stats.total} icon={<Target className="h-4 w-4" />} />
              <ComplianceIndicator label="Con Contenido" value={0} total={stats.total} icon={<FileText className="h-4 w-4" />} />
              <ComplianceIndicator label="Con Evaluación" value={0} total={stats.total} icon={<CheckCircle2 className="h-4 w-4" />} />
              <ComplianceIndicator label="Vinc. Competencias" value={0} total={stats.total} icon={<LinkIcon className="h-4 w-4" />} />
            </div>
          </div>
        </div>
      )}

      {/* Report View */}
      {activeTab === 'report' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-900">Reporte de Auditoría ISO 9001:2015</h2>
            <p className="text-slate-500">Requisito 7.2 - Competencia</p>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-800 mb-2">Evidencias de Cumplimiento</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Planificación de capacitación basada en brechas de competencias</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Definición de objetivos de aprendizaje para cada capacitación</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Registro de asistencia con firma digital</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Evaluación de satisfacción post-capacitación</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Evaluación de efectividad a 30-90 días</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Documentación de soporte (materiales, certificados)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg, suffix = '' }: { icon: React.ReactNode; label: string; value: number; bg: string; suffix?: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-slate-200`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <div className="text-2xl font-bold text-slate-900">{value}{suffix}</div>
    </div>
  );
}

function ComplianceIndicator({ label, value, total, icon }: { label: string; value: number; total: number; icon: React.ReactNode }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2 text-slate-600">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="text-xl font-bold text-slate-900">{value}<span className="text-sm font-normal text-slate-400">/{total}</span></div>
      <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }} /></div>
      <div className="text-xs text-slate-500 mt-1">{percentage}% cumplimiento</div>
    </div>
  );
}
