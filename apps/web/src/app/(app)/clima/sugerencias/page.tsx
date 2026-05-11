'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Search, X, CheckCircle, Clock, ArrowUp, ArrowLeft, Trash2, ClipboardList, CheckCircle2, QrCode } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: 'SUGERENCIA', label: 'Sugerencia' },
  { value: 'RECLAMO', label: 'Reclamo' },
  { value: 'INQUIETUD', label: 'Inquietud' },
  { value: 'MEJORA', label: 'Mejora' },
  { value: 'ALERTA', label: 'Alerta' },
];

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'ABIERTO', label: 'Abierto' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'RESUELTO', label: 'Resuelto' },
  { value: 'CERRADO', label: 'Cerrado' },
];

const PRIORIDADES = [
  { value: '', label: 'Todas' },
  { value: 'BAJA', label: 'Baja' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

const TYPE_COLORS: Record<string, string> = {
  SUGERENCIA: 'bg-blue-100 text-blue-700',
  RECLAMO: 'bg-red-100 text-red-700',
  INQUIETUD: 'bg-amber-100 text-amber-700',
  MEJORA: 'bg-emerald-100 text-emerald-700',
  ALERTA: 'bg-orange-100 text-orange-700',
  COMENTARIO: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  BAJA: 'bg-gray-100 text-gray-500',
  MEDIA: 'bg-blue-100 text-blue-600',
  ALTA: 'bg-amber-100 text-amber-700',
  CRITICA: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, any> = {
  ABIERTO: { icon: Clock, color: 'text-amber-500' },
  EN_PROCESO: { icon: ArrowUp, color: 'text-blue-500' },
  RESUELTO: { icon: CheckCircle, color: 'text-emerald-500' },
  CERRADO: { icon: X, color: 'text-gray-400' },
};

export default function SugerenciasPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', status: '', priority: '', search: '' });
  const [showQRModal, setShowQRModal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [newForm, setNewForm] = useState({ type: 'SUGERENCIA', title: '', content: '', priority: 'MEDIA', isAnonymous: true, category: '' });
  const [saving, setSaving] = useState(false);
  const [showCapa, setShowCapa] = useState(false);
  const [capaForm, setCapaForm] = useState({ title: '', description: '', criticality: 'MEDIA', dueDate: '', createNcr: false });
  const [savingCapa, setSavingCapa] = useState(false);
  const [capaCreada, setCapaCreada] = useState<string | null>(null);
  const [ncrCreada, setNcrCreada] = useState<{ id: string; code: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadItems(); }, []);
  useEffect(() => { loadItems(); }, [filters]);

  async function loadItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.search) params.set('search', filters.search);
      const data = await apiFetch(`/clima/sugerencias?${params}`) as any;
      setItems(data.suggestions || []);
    } catch { setItems([]); } finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.title.trim() || !newForm.content.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/clima/sugerencias', { method: 'POST', json: newForm });
      setShowNew(false);
      setNewForm({ type: 'SUGERENCIA', title: '', content: '', priority: 'MEDIA', isAnonymous: true, category: '' });
      loadItems();
    } catch { alert('Error al enviar'); } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiFetch(`/clima/sugerencias/${id}`, { method: 'PATCH', json: { status } });
      setSelected((prev: any) => prev ? { ...prev, status } : null);
      loadItems();
    } catch { alert('Error al actualizar estado'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta sugerencia?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/clima/sugerencias/${id}`, { method: 'DELETE' });
      setSelected(null);
      loadItems();
    } catch { alert('Error al eliminar'); } finally { setDeletingId(null); }
  }

  async function handleCrearCapa(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingCapa(true);
    try {
      const data = await apiFetch('/clima/planes-accion', {
        method: 'POST',
        json: {
          title: capaForm.title || `CAPA: ${selected.title}`,
          description: capaForm.description || selected.content,
          criticality: capaForm.criticality,
          dueDate: capaForm.dueDate || undefined,
          suggestionId: selected.id,
          createNcr: capaForm.createNcr,
        },
      }) as any;
      setCapaCreada(data.plan?.id || 'ok');
      if (data?.ncr) setNcrCreada({ id: data.ncr.id, code: data.ncr.code });
      setShowCapa(false);
      setCapaForm({ title: '', description: '', criticality: 'MEDIA', dueDate: '', createNcr: false });
    } catch { alert('Error al crear CAPA'); } finally { setSavingCapa(false); }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Sugerencias y Reclamos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Escucha permanente del equipo</p>
        </div>
        <button
          onClick={() => setShowQRModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors"
          title="Canal de participación QR"
        >
          <QrCode className="w-4 h-4" />
          QR Institucional
        </button>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar..." value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
            className="text-sm bg-transparent outline-none text-gray-700 w-full" />
        </div>
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none shadow-sm">
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none shadow-sm">
          {ESTADOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none shadow-sm">
          {PRIORIDADES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay sugerencias registradas</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-teal-600 font-medium">+ Agregar sugerencia</button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const StatusIcon = STATUS_ICONS[item.status]?.icon || Clock;
            return (
              <div key={item.id} onClick={() => { setSelected(item); setCapaCreada(null); }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer">
                <div className="flex items-start gap-3">
                  <StatusIcon className={`w-4 h-4 mt-1 flex-shrink-0 ${STATUS_ICONS[item.status]?.color || 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-600'}`}>{item.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[item.priority] || 'bg-gray-100 text-gray-500'}`}>{item.priority}</span>
                      {item.actionPlans?.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">CAPA vinculada</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{item.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{item.isAnonymous ? 'Anónimo' : item.employeeName}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nueva sugerencia / reclamo</h3>
              <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
                  <select value={newForm.type} onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {TIPOS.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Prioridad</label>
                  <select value={newForm.priority} onChange={e => setNewForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {PRIORIDADES.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
                <input type="text" required value={newForm.title} onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Resumen breve..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción *</label>
                <textarea required value={newForm.content} onChange={e => setNewForm(p => ({ ...p, content: e.target.value }))}
                  rows={4} placeholder="Detallá tu sugerencia o reclamo..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newForm.isAnonymous} onChange={e => setNewForm(p => ({ ...p, isAnonymous: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Enviar de forma anónima</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {saving ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selected.type] || 'bg-gray-100 text-gray-600'}`}>{selected.type}</span>
                <h3 className="font-semibold text-gray-900 text-sm">{selected.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id}
                  className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">{selected.content}</p>
              <div className="flex gap-2 text-xs text-gray-500">
                <span>Por: {selected.isAnonymous ? 'Anónimo' : selected.employeeName}</span>
                <span>·</span>
                <span>{new Date(selected.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              {selected.response && (
                <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                  <p className="text-xs font-semibold text-teal-700 mb-1">Respuesta</p>
                  <p className="text-sm text-gray-700">{selected.response}</p>
                </div>
              )}
              {/* Estado */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Estado</p>
                <div className="flex gap-2">
                  {['ABIERTO', 'EN_PROCESO', 'RESUELTO'].map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={`flex-1 text-xs py-2 rounded-xl border transition-colors font-medium ${selected.status === s ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {s === 'ABIERTO' ? 'Abierto' : s === 'EN_PROCESO' ? 'En proceso' : 'Resuelto'}
                    </button>
                  ))}
                </div>
              </div>
              {/* CAPA */}
              <div className="pt-2 border-t border-gray-100">
                {capaCreada ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">CAPA creada correctamente</span>
                      <button onClick={() => router.push(`/clima/planes-accion`)} className="ml-auto text-xs underline">Ver planes</button>
                    </div>
                    {ncrCreada && (
                      <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-xl px-4 py-2.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">NCR {ncrCreada.code} creada en módulo general</span>
                        <button onClick={() => router.push(`/no-conformidades`)} className="ml-auto text-xs underline">Ver NCR</button>
                      </div>
                    )}
                  </div>
                ) : selected.actionPlans?.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-2.5">
                    <ClipboardList className="w-4 h-4" />
                    <span className="font-medium">{selected.actionPlans.length} CAPA vinculada{selected.actionPlans.length > 1 ? 's' : ''}</span>
                    <button onClick={() => router.push(`/clima/planes-accion`)} className="ml-auto text-xs underline">Ver</button>
                  </div>
                ) : (
                  <button onClick={() => { setCapaForm({ title: `CAPA: ${selected.title}`, description: selected.content, criticality: 'MEDIA', dueDate: '', createNcr: false }); setNcrCreada(null); setShowCapa(true); }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-purple-700 border border-purple-200 hover:bg-purple-50 py-2.5 rounded-xl transition-colors font-medium">
                    <ClipboardList className="w-4 h-4" />
                    Crear plan de acción (CAPA)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CAPA Modal */}
      {showCapa && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo Plan de Acción (CAPA)</h3>
              <button onClick={() => setShowCapa(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCrearCapa} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
                <input type="text" required value={capaForm.title} onChange={e => setCapaForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
                <textarea value={capaForm.description} onChange={e => setCapaForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Criticidad</label>
                  <select value={capaForm.criticality} onChange={e => setCapaForm(p => ({ ...p, criticality: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {['BAJA','MEDIA','ALTA','CRITICA'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha límite</label>
                  <input type="date" value={capaForm.dueDate} onChange={e => setCapaForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={capaForm.createNcr} onChange={e => setCapaForm(p => ({ ...p, createNcr: e.target.checked }))}
                  className="rounded border-gray-300" />
                Crear también como NCR en módulo general
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCapa(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={savingCapa} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {savingCapa ? 'Guardando...' : 'Crear CAPA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Institucional Modal */}
      {showQRModal && <QRInstitucionalModal onClose={() => setShowQRModal(false)} />}
    </div>
  );
}

// Componente Modal QR Institucional
function QRInstitucionalModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadQRData();
  }, []);

  const loadQRData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/clima/canal-qr');
      setQrData(res);
    } catch (err) {
      setError('Error cargando datos del QR');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('¿Generar nuevo QR? El anterior dejará de funcionar.')) return;
    try {
      setRegenerating(true);
      const res = await apiFetch('/clima/canal-qr', { method: 'POST' });
      setQrData(res);
    } catch (err) {
      setError('Error regenerando QR');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!qrData) return;
    // Abrir en nueva pestaña para generar PDF
    window.open(`/api/clima/canal-qr/pdf?token=${qrData.token}`, '_blank');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('¡Enlace copiado al portapapeles!');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Canal QR Institucional</h3>
            <p className="text-sm text-gray-500">Compartí este QR para recibir sugerencias anónimas</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-gray-500">Cargando...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">{error}</p>
              <button onClick={loadQRData} className="text-blue-600 text-sm underline">Reintentar</button>
            </div>
          ) : qrData ? (
            <>
              {/* QR Preview */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 text-center">
                <div className="bg-white rounded-xl p-4 shadow-lg inline-block mb-3">
                  {/* Aquí iría el QR code real - usando placeholder por ahora */}
                  <div className="w-48 h-48 bg-gray-900 rounded-lg flex items-center justify-center">
                    <QrCode className="w-32 h-32 text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700">Escaneá para participar</p>
                <p className="text-xs text-gray-500 mt-1">Válido desde: {new Date(qrData.stats.generatedAt).toLocaleDateString()}</p>
              </div>

              {/* URL Pública */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL del canal</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrData.publicUrl}
                    readOnly
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(qrData.publicUrl)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{qrData.stats.useCount}</p>
                  <p className="text-xs text-gray-500">Visitas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{qrData.isActive ? 'Activo' : 'Inactivo'}</p>
                  <p className="text-xs text-gray-500">Estado</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{qrData.stats.lastUsedAt ? new Date(qrData.stats.lastUsedAt).toLocaleDateString() : 'Nunca'}</p>
                  <p className="text-xs text-gray-500">Último uso</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar cartel PDF
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                  {regenerating ? 'Generando...' : 'Regenerar QR'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Icons needed
function Loader2(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

function Download(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
  );
}

function RefreshCw(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
