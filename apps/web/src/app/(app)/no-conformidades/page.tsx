'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { NonConformity, NCRStats, NCRSeverity, NCRSource } from '@/lib/types';
import {
  AlertTriangle, Plus, X, Search, AlertCircle, CheckCircle2, Clock, Target, BrainCircuit
} from 'lucide-react';

// Tipo para hallazgos de IA
type AiFinding = {
  id: string;
  title: string;
  description: string;
  severity: 'MUST' | 'SHOULD' | 'MUST_NOT';
  standard: string;
  clause: string;
  confidence: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CONVERTED_TO_NCR';
  createdAt: string;
  auditRun: {
    id: string;
    document: { title: string };
    normative: { name: string; code: string };
  };
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Crítica', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  MAJOR: { label: 'Mayor', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  MINOR: { label: 'Menor', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  OBSERVATION: { label: 'Observación', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Abierta', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  IN_ANALYSIS: { label: 'En análisis', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  ACTION_PLANNED: { label: 'Acción planificada', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  IN_PROGRESS: { label: 'En progreso', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  VERIFICATION: { label: 'Verificación', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  CLOSED: { label: 'Cerrada', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  CANCELLED: { label: 'Cancelada', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

const SOURCE_OPTIONS: { value: NCRSource; label: string }[] = [
  { value: 'INTERNAL_AUDIT', label: 'Auditoría interna' },
  { value: 'EXTERNAL_AUDIT', label: 'Auditoría externa' },
  { value: 'CUSTOMER_COMPLAINT', label: 'Reclamo de cliente' },
  { value: 'PROCESS_DEVIATION', label: 'Desvío de proceso' },
  { value: 'SUPPLIER_ISSUE', label: 'Problema de proveedor' },
  { value: 'AI_FINDING', label: 'Hallazgo IA' },
  { value: 'OTHER', label: 'Otro' },
];

export default function NoConformidadesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ncrs, setNcrs] = useState<NonConformity[]>([]);
  const [stats, setStats] = useState<NCRStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSource, setFilterSource] = useState(searchParams?.get('source') || 'ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'MAJOR' as NCRSeverity, source: 'INTERNAL_AUDIT' as NCRSource, standard: '', clause: '' });
  const [showCreateFromFinding, setShowCreateFromFinding] = useState(false);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);

  async function loadFindings() {
    setLoadingFindings(true);
    try {
      const res = await apiFetch<{ findings: AiFinding[] }>('/audit/findings?status=OPEN');
      setFindings(res.findings ?? []);
    } catch (err: any) {
      console.error('Error loading findings:', err);
    } finally {
      setLoadingFindings(false);
    }
  }

  async function convertFindingToNCR(findingId: string) {
    try {
      const res = await apiFetch<{ success: boolean; message: string; nonConformity: { id: string; code: string } }>(`/audit/findings/${findingId}/convert-to-ncr`, {
        method: 'POST',
      });
      setSuccess(`NCR creada: ${res.nonConformity.code}`);
      setShowCreateFromFinding(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al convertir a NCR');
    }
  }

  async function load() {
    setError(null); setLoading(true);
    try {
      const [ncrsRes, statsRes] = await Promise.all([
        apiFetch<{ ncrs: NonConformity[] }>('/ncr'),
        apiFetch<{ stats: NCRStats }>('/ncr/stats'),
      ]);
      setNcrs(ncrsRes.ncrs ?? []); setStats(statsRes.stats ?? null);
    } catch (err: any) {
      setError(err?.message ?? 'Error'); if (err?.message === 'Unauthorized') router.push('/login');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setError(null);
    try {
      await apiFetch('/ncr', { method: 'POST', json: form });
      setSuccess('No conformidad creada correctamente'); setShowCreate(false);
      setForm({ title: '', description: '', severity: 'MAJOR', source: 'INTERNAL_AUDIT', standard: '', clause: '' });
      await load();
    } catch (err: any) { setError(err?.message ?? 'Error al crear'); } finally { setCreating(false); }
  }

  const filtered = ncrs.filter(n => {
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase()) && !n.code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterStatus !== 'ALL' && n.status !== filterStatus) return false;
    if (filterSource !== 'ALL' && n.source !== filterSource) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold text-neutral-900">No Conformidades</h1><p className="mt-1 text-sm text-neutral-500">Gestión de no conformidades y acciones correctivas</p></div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setShowCreateFromFinding(true); loadFindings(); setError(null); setSuccess(null); }} 
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 transition-colors"
          >
            <BrainCircuit className="h-4 w-4" /> Desde Hallazgo IA
          </button>
          <button onClick={() => { setShowCreate(!showCreate); setError(null); setSuccess(null); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors">
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showCreate ? 'Cancelar' : 'Nueva NCR'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-brand-50 p-2"><Target className="h-5 w-5 text-brand-600" /></div><div><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-neutral-500">Total NCRs</div></div></div></div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-red-100 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div><div><div className="text-2xl font-bold text-red-700">{stats.open}</div><div className="text-xs text-red-600">Abiertas</div></div></div></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-amber-100 p-2"><Clock className="h-5 w-5 text-amber-600" /></div><div><div className="text-2xl font-bold text-amber-700">{stats.inProgress}</div><div className="text-xs text-amber-600">En progreso</div></div></div></div>
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-green-100 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div><div><div className="text-2xl font-bold text-green-700">{stats.closed}</div><div className="text-xs text-green-600">Cerradas</div></div></div></div>
        </div>
      )}

      {showCreateFromFinding && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-purple-600" />
              Crear NCR desde Hallazgo de Auditoría IA
            </h2>
            <button onClick={() => setShowCreateFromFinding(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {loadingFindings ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
            </div>
          ) : findings.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <BrainCircuit className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
              <p>No hay hallazgos de auditoría IA disponibles</p>
              <p className="text-sm mt-1">Los hallazgos aparecerán aquí cuando la IA detecte no conformidades en documentos</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {findings.map(f => (
                <div key={f.id} className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-purple-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded p-1.5 ${f.severity === 'MUST' ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <AlertTriangle className={`h-4 w-4 ${f.severity === 'MUST' ? 'text-red-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${f.severity === 'MUST' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                          {f.severity === 'MUST' ? 'Importante' : 'Recomendación'}
                        </span>
                        <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{f.clause}</span>
                      </div>
                      <h3 className="mt-1 font-medium text-sm text-neutral-900">{f.title}</h3>
                      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{f.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                        <span>Documento: {f.auditRun?.document?.title}</span>
                        <span>•</span>
                        <span>Norma: {f.auditRun?.normative?.code}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => convertFindingToNCR(f.id)}
                          className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Crear No Conformidad
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-brand-200 bg-brand-50/30 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Nueva No Conformidad</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="block text-sm font-medium text-neutral-700 mb-1">Título</label><input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label><textarea className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-neutral-700 mb-1">Severidad</label><select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" value={form.severity} onChange={e => setForm({...form, severity: e.target.value as NCRSeverity})}>{Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-neutral-700 mb-1">Origen</label><select className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" value={form.source} onChange={e => setForm({...form, source: e.target.value as NCRSource})}>{SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-neutral-700 mb-1">Norma (opcional)</label><input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" placeholder="ISO 9001" value={form.standard} onChange={e => setForm({...form, standard: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-neutral-700 mb-1">Cláusula (opcional)</label><input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm" placeholder="8.2.1" value={form.clause} onChange={e => setForm({...form, clause: e.target.value})} /></div>
          </div>
          <button type="submit" disabled={creating} className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"><Plus className="h-4 w-4" /> {creating ? 'Creando...' : 'Crear NCR'}</button>
        </form>
      )}

      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" /> {error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" /> {success}</div>}

      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" /><input type="text" placeholder="Buscar NCRs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 outline-none" /></div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"><option value="ALL">Todos los estados</option>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm">
          <option value="ALL">Todos los orígenes</option>
          {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-12 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-neutral-300" />
          <h3 className="mt-4 text-lg font-medium text-neutral-900">{ncrs.length === 0 ? 'Sin no conformidades' : 'Sin resultados'}</h3>
          <p className="mt-1 text-sm text-neutral-500">{ncrs.length === 0 ? 'Creá la primera NCR para comenzar.' : 'Probá con otros filtros.'}</p>
          {ncrs.length === 0 && <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> Crear NCR</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ncr => {
            const sev = SEVERITY_CONFIG[ncr.severity] ?? SEVERITY_CONFIG.MAJOR;
            const st = STATUS_CONFIG[ncr.status] ?? STATUS_CONFIG.OPEN;
            return (
              <div key={ncr.id} onClick={() => router.push(`/no-conformidades/${ncr.id}`)} className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded p-1.5 ${ncr.severity === 'CRITICAL' ? 'bg-red-100' : ncr.severity === 'MAJOR' ? 'bg-orange-100' : 'bg-amber-100'}`}>
                    <AlertTriangle className={`h-4 w-4 ${ncr.severity === 'CRITICAL' ? 'text-red-600' : ncr.severity === 'MAJOR' ? 'text-orange-600' : 'text-amber-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{ncr.code}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.color}`}>{sev.label}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                    </div>
                    <h3 className="mt-1 font-medium text-sm text-neutral-900">{ncr.title}</h3>
                    <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{ncr.description}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-400">
                      {ncr.standard && <span>{ncr.standard} {ncr.clause && `§${ncr.clause}`}</span>}
                      <span>{new Date(ncr.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {ncr.assignedTo && <span>→ {ncr.assignedTo.email}</span>}
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
