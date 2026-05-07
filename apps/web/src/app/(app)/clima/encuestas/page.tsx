'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ClipboardList, ChevronRight, Users, CheckCircle, Clock, MoreVertical, Trash2, Eye, Send, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  CLIMA_LABORAL: 'Clima Laboral',
  SATISFACCION: 'Satisfacción',
  LIDERAZGO: 'Liderazgo',
  ONBOARDING: 'Onboarding',
  BIENESTAR: 'Bienestar',
  RIESGOS_PSICOSOCIALES: 'Riesgos Psicosociales',
  BURNOUT: 'Burnout',
  COMUNICACION_INTERNA: 'Comunicación',
  PERSONALIZADA: 'Personalizada',
};

const CATEGORY_COLORS: Record<string, string> = {
  CLIMA_LABORAL: 'bg-blue-100 text-blue-700',
  SATISFACCION: 'bg-purple-100 text-purple-700',
  LIDERAZGO: 'bg-amber-100 text-amber-700',
  BIENESTAR: 'bg-emerald-100 text-emerald-700',
  BURNOUT: 'bg-red-100 text-red-700',
  ONBOARDING: 'bg-cyan-100 text-cyan-700',
  default: 'bg-gray-100 text-gray-700',
};

export default function EncuestasClimaPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - i));
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => { loadSurveys(); }, []);

  async function loadSurveys() {
    setLoading(true);
    try {
      const data = await apiFetch('/clima/encuestas') as any;
      setSurveys(data.surveys || []);
    } catch { setSurveys([]); } finally { setLoading(false); }
  }

  async function deleteSurvey(id: string) {
    if (!confirm('¿Eliminar esta encuesta?')) return;
    await apiFetch(`/clima/encuestas/${id}`, { method: 'DELETE' });
    loadSurveys();
  }

  const filtered = surveys.filter(s => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase());
    const matchYear = !yearFilter || s.code?.includes(`-${yearFilter}-`) || new Date(s.createdAt).getFullYear() === Number(yearFilter);
    return matchSearch && matchYear;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Encuestas de Clima</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} encuestas{yearFilter ? ` en ${yearFilter}` : ' en total'}</p>
        </div>
        <button
          onClick={() => router.push('/clima/encuestas/nueva')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva encuesta
        </button>
      </div>

      {/* Search + Year filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar por título o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
          />
        </div>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none shadow-sm">
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay encuestas creadas</p>
          <p className="text-sm text-gray-400 mt-1">Creá tu primera encuesta de clima laboral</p>
          <button onClick={() => router.push('/clima/encuestas/nueva')} className="mt-4 text-sm text-teal-600 hover:text-teal-800 font-medium">
            + Crear encuesta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const catColor = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.default;
            const catLabel = CATEGORY_LABELS[s.category] || s.category;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4 p-4">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/clima/encuestas/${s.id}`)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{s.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{catLabel}</span>
                      <span className="text-xs text-gray-400">{s.code}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.totalRecipients ?? s._count?.recipients ?? 0} destinatarios</span>
                      <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" />{s.completedCount ?? 0} completas</span>
                      {s.participationRate != null && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.participationRate}% participación</span>
                      )}
                      <span>{s._count?.questions ?? 0} preguntas</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 relative">
                    <button
                      onClick={() => router.push(`/clima/encuestas/${s.id}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-teal-600 transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/clima/encuestas/${s.id}/enviar`)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                      title="Enviar a empleados"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === s.id ? null : s.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === s.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[140px] overflow-hidden">
                          <button
                            onClick={() => { setActiveMenu(null); router.push(`/clima/encuestas/${s.id}/resultados`); }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />Resultados
                          </button>
                          <button
                            onClick={() => { setActiveMenu(null); deleteSurvey(s.id); }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
