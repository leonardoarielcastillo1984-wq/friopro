'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Truck, TrendingUp, AlertTriangle, Star, BarChart3, Plus, Search, RefreshCw, Edit2, Trash2, ClipboardCheck, X, Clock, CheckCircle } from 'lucide-react';

interface Supplier {
  id: string; code: string; name: string; legalName?: string; taxId?: string; email?: string; phone?: string;
  address?: string; category?: string; contactName?: string; contactPosition?: string;
  status: string; providerType?: string | null; isCritical: boolean;
  evaluationScore?: number | null; avgScore?: number | null; computedStatus?: string;
  lastEvaluationDate?: string | null; nextEvaluationDate?: string | null; notes?: string;
  createdAt: string; _count?: { evaluations: number };
}

interface SupplierStats {
  total: number; critical: number; withoutEval90: number; avgOverall: number | null;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    APPROVED: 'bg-green-100 text-green-700', CONDITIONAL: 'bg-amber-100 text-amber-700',
    REJECTED: 'bg-red-100 text-red-700', PENDING: 'bg-gray-100 text-gray-700', SUSPENDED: 'bg-purple-100 text-purple-700',
  };
  const label: Record<string, string> = {
    APPROVED: 'Aprobado', CONDITIONAL: 'Condicional', REJECTED: 'Rechazado', PENDING: 'Pendiente', SUSPENDED: 'Suspendido',
  };
  return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${map[status] || map.PENDING}`}>{label[status] || status}</span>;
};

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats>({ total: 0, critical: 0, withoutEval90: 0, avgOverall: null });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalSupplier, setEvalSupplier] = useState<Supplier | null>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [evalForm, setEvalForm] = useState({ qualityScore: 3, deliveryScore: 3, priceScore: 3, serviceScore: 3, documentationScore: 3, comments: '' });
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ status: 'PENDING', isCritical: false });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [supRes, statsRes] = await Promise.all([
        apiFetch<{ suppliers: Supplier[] }>('/suppliers'),
        apiFetch<{ stats: SupplierStats }>('/suppliers/stats').catch(() => null),
      ]);
      setSuppliers(supRes?.suppliers || []);
      if (statsRes?.stats) setStats(statsRes.stats);
    } catch (err) { console.error('Error loading suppliers:', err); }
    finally { setLoading(false); }
  };

  const filtered = suppliers.filter(s => {
    const m = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.toLowerCase().includes(searchQuery.toLowerCase());
    const st = !filterStatus || (s.computedStatus || s.status) === filterStatus;
    return m && st;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar proveedor?')) return;
    try { await apiFetch(`/suppliers/${id}`, { method: 'DELETE' }); await loadData(); }
    catch (err) { console.error(err); }
  };

  const openEval = (s: Supplier) => {
    setEvalSupplier(s);
    setEvalForm({ qualityScore: 3, deliveryScore: 3, priceScore: 3, serviceScore: 3, documentationScore: 3, comments: '' });
    setShowEvalModal(true);
  };

  const handleCreateEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalSupplier) return;
    try {
      await apiFetch(`/suppliers/${evalSupplier.id}/evaluations`, { method: 'POST', json: evalForm });
      setShowEvalModal(false); await loadData();
    } catch (err) { console.error(err); alert('Error al guardar evaluación'); }
  };

  const handleAi = async () => {
    setAiLoading(true);
    try { const r = await apiFetch<{ analysis: any }>('/suppliers/analyze', { method: 'POST', json: {} }); setAiAnalysis(r?.analysis); setShowAiAnalysis(true); }
    catch (err) { console.error(err); }
    finally { setAiLoading(false); }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) await apiFetch(`/suppliers/${editingSupplier.id}`, { method: 'PATCH', json: supplierForm });
      else await apiFetch('/suppliers', { method: 'POST', json: supplierForm });
      setShowSupplierModal(false); setEditingSupplier(null); setSupplierForm({ status: 'PENDING', isCritical: false });
      await loadData();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Truck className="w-6 h-6 text-blue-600" /> Proveedores</h1>
          <p className="text-gray-600 mt-1">Gestión y evaluación de proveedores (ISO 9001 §8.4)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleAi} disabled={aiLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
            <BarChart3 className="w-4 h-4" /> {aiLoading ? 'Analizando...' : 'Analizar proveedores'}
          </button>
          <button onClick={() => { setEditingSupplier(null); setSupplierForm({ status: 'PENDING', isCritical: false }); setShowSupplierModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-lg"><Truck className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-gray-600">Total</p><p className="text-xl font-bold text-gray-900">{stats.total}</p></div></div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-red-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-gray-600">En riesgo</p><p className="text-xl font-bold text-gray-900">{stats.critical}</p></div></div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-sm text-gray-600">Sin evaluar 90 días</p><p className="text-xl font-bold text-gray-900">{stats.withoutEval90}</p></div></div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-gray-600">Score promedio</p><p className="text-xl font-bold text-gray-900">{stats.avgOverall?.toFixed(1) ?? '—'}</p></div></div></div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
          <option value="">Todos</option><option value="APPROVED">Aprobado</option><option value="CONDITIONAL">Condicional</option><option value="REJECTED">Rechazado</option><option value="PENDING">Pendiente</option>
        </select>
        <button onClick={loadData} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Código</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Última eval.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Acciones</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-8 text-gray-500">Cargando...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-500">No hay proveedores</td></tr>
              : filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.code}</td>
                  <td className="px-4 py-3 text-sm"><Link href={`/proveedores/${s.id}`} className="hover:text-blue-600 hover:underline">{s.name}</Link></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-sm"><div className="flex items-center gap-1"><Star className={`w-4 h-4 ${(s.avgScore||0)>=4?'text-amber-500 fill-amber-500':(s.avgScore||0)>=3?'text-amber-400':'text-gray-300'}`} /><span className="font-medium">{s.avgScore?.toFixed(1) ?? '—'}</span></div></td>
                  <td className="px-4 py-3 text-sm">{statusBadge(s.computedStatus || s.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.providerType || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.lastEvaluationDate ? new Date(s.lastEvaluationDate).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-4 py-3 text-sm"><div className="flex items-center gap-1">
                    <button onClick={() => openEval(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Evaluar"><ClipboardCheck className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingSupplier(s); setSupplierForm(s); setShowSupplierModal(true); }} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="Editar"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editingSupplier ? 'Editar' : 'Nuevo'} Proveedor</h2>
              <button onClick={() => setShowSupplierModal(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label><input required value={supplierForm.name || ''} onChange={e => setSupplierForm({...supplierForm,name:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Razón social</label><input value={supplierForm.legalName || ''} onChange={e => setSupplierForm({...supplierForm,legalName:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label><input value={supplierForm.taxId || ''} onChange={e => setSupplierForm({...supplierForm,taxId:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={supplierForm.email || ''} onChange={e => setSupplierForm({...supplierForm,email:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={supplierForm.phone || ''} onChange={e => setSupplierForm({...supplierForm,phone:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label><input value={supplierForm.category || ''} placeholder="Insumos, servicios..." onChange={e => setSupplierForm({...supplierForm,category:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label><input value={supplierForm.contactName || ''} onChange={e => setSupplierForm({...supplierForm,contactName:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label><input value={supplierForm.contactPosition || ''} onChange={e => setSupplierForm({...supplierForm,contactPosition:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input value={supplierForm.address || ''} onChange={e => setSupplierForm({...supplierForm,address:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={supplierForm.status || 'PENDING'} onChange={e => setSupplierForm({...supplierForm,status:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="PENDING">Pendiente</option><option value="APPROVED">Aprobado</option><option value="CONDITIONAL">Condicional</option><option value="REJECTED">Rechazado</option><option value="SUSPENDED">Suspendido</option>
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={supplierForm.providerType || ''} onChange={e => setSupplierForm({...supplierForm,providerType:e.target.value||null})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin clasificar</option><option value="Estratégico">Estratégico</option><option value="Crítico">Crítico</option><option value="Secundario">Secundario</option>
                  </select></div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="isCritical" checked={!!supplierForm.isCritical} onChange={e => setSupplierForm({...supplierForm,isCritical:e.target.checked})} className="rounded" /><label htmlFor="isCritical" className="text-sm text-gray-700">Proveedor crítico</label></div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingSupplier ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Eval Modal */}
      {showEvalModal && evalSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Evaluar: {evalSupplier.name}</h2>
              <button onClick={() => setShowEvalModal(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateEval} className="p-6 space-y-4">
              {[
                { k: 'qualityScore' as const, l: 'Calidad' }, { k: 'deliveryScore' as const, l: 'Cumplimiento' },
                { k: 'priceScore' as const, l: 'Precio' }, { k: 'serviceScore' as const, l: 'Servicio' },
                { k: 'documentationScore' as const, l: 'Documentación' },
              ].map(({ k, l }) => (
                <div key={k} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{l} (1-5)</label>
                  <div className="flex items-center gap-2"><input type="range" min={1} max={5} value={evalForm[k]} onChange={e => setEvalForm({...evalForm,[k]:Number(e.target.value)})} className="w-24" /><span className="w-6 text-center font-bold">{evalForm[k]}</span></div>
                </div>
              ))}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label><textarea value={evalForm.comments} onChange={e => setEvalForm({...evalForm,comments:e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between"><span className="text-sm font-medium">Score calculado:</span><span className="text-lg font-bold">{((evalForm.qualityScore+evalForm.deliveryScore+evalForm.priceScore+evalForm.serviceScore+evalForm.documentationScore)/5).toFixed(1)}</span></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEvalModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar evaluación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAiAnalysis && aiAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900"><BarChart3 className="w-5 h-5 inline mr-2 text-indigo-600" />Análisis de Proveedores</h2>
              <button onClick={() => setShowAiAnalysis(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4"><div className="text-2xl font-bold text-blue-900">{aiAnalysis.overallAvg?.toFixed(1) ?? '—'}</div><div className="text-sm text-blue-700">Score Promedio</div></div>
                <div className="bg-red-50 rounded-lg p-4"><div className="text-2xl font-bold text-red-900">{aiAnalysis.highRiskCount ?? 0}</div><div className="text-sm text-red-700">Proveedores críticos</div></div>
                <div className="bg-amber-50 rounded-lg p-4"><div className="text-2xl font-bold text-amber-900">{aiAnalysis.withoutEvalCount ?? 0}</div><div className="text-sm text-amber-700">Sin evaluar reciente</div></div>
              </div>
              {aiAnalysis.recommendations?.length > 0 && (
                <div><h3 className="text-sm font-semibold text-gray-900 mb-3">Recomendaciones</h3>
                  <div className="space-y-2">{aiAnalysis.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 bg-indigo-50 rounded-lg p-3"><CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" /><span className="text-sm text-indigo-900">{r}</span></div>
                  ))}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
