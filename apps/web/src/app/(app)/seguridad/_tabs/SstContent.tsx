'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, X, FileSignature, HardHat, Stethoscope } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────

type WorkPermit = {
  id: string; code: string; type: string; title: string; location: string;
  description?: string; status: string; requestedBy?: string; approvedBy?: string;
  approvedAt?: string; startDate: string; endDate: string; workers: string[];
  hazards?: string; controls?: string; ppeRequired: string[]; closedAt?: string;
};

type PpeDelivery = {
  id: string; employeeName?: string; item: string; size?: string; quantity: number;
  deliveredAt: string; expiryDate?: string; receivedBy?: string; deliveredBy?: string; notes?: string;
};

type MedicalExam = {
  id: string; employeeName?: string; examType: string; examDate: string; result: string;
  restrictions?: string; nextExamDate?: string; performedBy?: string; notes?: string;
};

const PERMIT_TYPES: Record<string, string> = {
  HEIGHTS: 'Trabajo en altura', HOT_WORK: 'Trabajo en caliente', CONFINED_SPACE: 'Espacio confinado',
  ELECTRICAL: 'Trabajo eléctrico', EXCAVATION: 'Excavación', LIFTING: 'Izaje', OTHER: 'Otro',
};
const PERMIT_STATUS: Record<string, string> = {
  REQUESTED: 'Solicitado', APPROVED: 'Aprobado', IN_PROGRESS: 'En curso',
  SUSPENDED: 'Suspendido', CLOSED: 'Cerrado', REJECTED: 'Rechazado',
};
const PERMIT_STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-700', APPROVED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700', SUSPENDED: 'bg-red-100 text-red-700',
  CLOSED: 'bg-gray-100 text-gray-600', REJECTED: 'bg-red-200 text-red-800',
};
const EXAM_TYPES: Record<string, string> = {
  PRE_EMPLOYMENT: 'Preocupacional', PERIODIC: 'Periódico', RETURN_TO_WORK: 'Reincorporación',
  EXIT: 'Egreso', SPECIAL: 'Especial',
};
const EXAM_RESULTS: Record<string, { label: string; cls: string }> = {
  FIT: { label: 'Apto', cls: 'bg-emerald-100 text-emerald-700' },
  FIT_WITH_RESTRICTIONS: { label: 'Apto c/restricciones', cls: 'bg-amber-100 text-amber-700' },
  UNFIT: { label: 'No apto', cls: 'bg-red-100 text-red-700' },
  PENDING: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
};

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
const isOverdue = (d?: string) => d && new Date(d) < new Date();

export default function SstContent() {
  const [sub, setSub] = useState<'permits' | 'ppe' | 'exams'>('permits');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'permits', label: 'Permisos de trabajo', icon: FileSignature },
          { k: 'ppe', label: 'Entregas EPP', icon: HardHat },
          { k: 'exams', label: 'Exámenes médicos', icon: Stethoscope },
        ].map(t => (
          <button key={t.k} onClick={() => setSub(t.k as any)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              sub === t.k ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {sub === 'permits' && <PermitsSection />}
      {sub === 'ppe' && <PpeSection />}
      {sub === 'exams' && <ExamsSection />}
    </div>
  );
}

// ── Permisos de trabajo (ISO 45001 §8.1) ─────────────────────

function PermitsSection() {
  const [items, setItems] = useState<WorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'HOT_WORK', title: '', location: '', description: '', requestedBy: '', startDate: '', endDate: '', hazards: '', controls: '', workers: '', ppeRequired: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ items: WorkPermit[] }>('/sst/work-permits'); setItems(r?.items || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/sst/work-permits', {
        method: 'POST',
        json: { ...form, workers: form.workers.split(',').map(s => s.trim()).filter(Boolean), ppeRequired: form.ppeRequired.split(',').map(s => s.trim()).filter(Boolean) },
      });
      setShowModal(false);
      setForm({ code: '', type: 'HOT_WORK', title: '', location: '', description: '', requestedBy: '', startDate: '', endDate: '', hazards: '', controls: '', workers: '', ppeRequired: '' });
      await load();
    } finally { setSaving(false); }
  }

  async function setStatus(id: string, status: string) {
    await apiFetch(`/sst/work-permits/${id}`, { method: 'PATCH', json: { status } });
    await load();
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar permiso?')) return;
    await apiFetch(`/sst/work-permits/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Permisos de trabajo de alto riesgo — ISO 45001 §8.1</p>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo permiso
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Trabajo</th>
              <th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Vigencia</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin permisos registrados</td></tr>}
            {items.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                <td className="px-4 py-3">{PERMIT_TYPES[p.type] || p.type}</td>
                <td className="px-4 py-3"><div className="font-medium">{p.title}</div>{p.requestedBy && <div className="text-xs text-gray-500">Solicita: {p.requestedBy}</div>}</td>
                <td className="px-4 py-3">{p.location}</td>
                <td className="px-4 py-3 text-xs">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PERMIT_STATUS_COLORS[p.status] || 'bg-gray-100'}`}>{PERMIT_STATUS[p.status] || p.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {p.status === 'REQUESTED' && <>
                      <button onClick={() => setStatus(p.id, 'APPROVED')} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">Aprobar</button>
                      <button onClick={() => setStatus(p.id, 'REJECTED')} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Rechazar</button>
                    </>}
                    {p.status === 'APPROVED' && <button onClick={() => setStatus(p.id, 'IN_PROGRESS')} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Iniciar</button>}
                    {(p.status === 'APPROVED' || p.status === 'IN_PROGRESS') && <button onClick={() => setStatus(p.id, 'CLOSED')} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">Cerrar</button>}
                    <button onClick={() => remove(p.id)} className="rounded p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="w-full max-w-2xl rounded-xl bg-white max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Nuevo permiso de trabajo</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Código *</label><input required className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PT-2026-001" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
                <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(PERMIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Trabajo a realizar *</label><input required className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Ubicación *</label><input required className={inputCls} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Solicitado por</label><input className={inputCls} value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Inicio *</label><input required type="datetime-local" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Fin *</label><input required type="datetime-local" className={inputCls} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Personal autorizado (separado por comas)</label><input className={inputCls} value={form.workers} onChange={e => setForm({ ...form, workers: e.target.value })} /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Peligros identificados</label><textarea rows={2} className={inputCls} value={form.hazards} onChange={e => setForm({ ...form, hazards: e.target.value })} /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Medidas de control / aislamiento</label><textarea rows={2} className={inputCls} value={form.controls} onChange={e => setForm({ ...form, controls: e.target.value })} /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">EPP requerido (separado por comas)</label><input className={inputCls} value={form.ppeRequired} onChange={e => setForm({ ...form, ppeRequired: e.target.value })} placeholder="Arnés, casco, detector de gases..." /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Entregas de EPP (ISO 45001 §8.1.2) ───────────────────────

function PpeSection() {
  const [items, setItems] = useState<PpeDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeName: '', item: '', size: '', quantity: 1, deliveredAt: new Date().toISOString().split('T')[0], expiryDate: '', receivedBy: '', deliveredBy: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ items: PpeDelivery[] }>('/sst/ppe-deliveries'); setItems(r?.items || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/sst/ppe-deliveries', {
        method: 'POST',
        json: { ...form, quantity: Number(form.quantity) || 1, expiryDate: form.expiryDate || null, size: form.size || null, receivedBy: form.receivedBy || null, deliveredBy: form.deliveredBy || null, notes: form.notes || null },
      });
      setShowModal(false);
      setForm({ employeeName: '', item: '', size: '', quantity: 1, deliveredAt: new Date().toISOString().split('T')[0], expiryDate: '', receivedBy: '', deliveredBy: '', notes: '' });
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar entrega?')) return;
    await apiFetch(`/sst/ppe-deliveries/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Registro de entrega de elementos de protección personal — ISO 45001 §8.1.2</p>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Registrar entrega
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Trabajador</th><th className="px-4 py-3">EPP</th><th className="px-4 py-3">Talle</th>
              <th className="px-4 py-3">Cant.</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Recibió</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin entregas registradas</td></tr>}
            {items.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{d.employeeName || '—'}</td>
                <td className="px-4 py-3">{d.item}</td>
                <td className="px-4 py-3">{d.size || '—'}</td>
                <td className="px-4 py-3">{d.quantity}</td>
                <td className="px-4 py-3">{fmtDate(d.deliveredAt)}</td>
                <td className="px-4 py-3">
                  {d.expiryDate
                    ? <span className={isOverdue(d.expiryDate) ? 'font-medium text-red-600' : ''}>{fmtDate(d.expiryDate)}{isOverdue(d.expiryDate) && ' ⚠'}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs">{d.receivedBy || '—'}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => remove(d.id)} className="rounded p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="w-full max-w-lg rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Registrar entrega de EPP</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Trabajador *</label><input required className={inputCls} value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">EPP *</label><input required className={inputCls} value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="Casco, guantes dieléctricos..." /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Talle / medida</label><input className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Cantidad</label><input type="number" min={1} className={inputCls} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Fecha entrega</label><input type="date" className={inputCls} value={form.deliveredAt} onChange={e => setForm({ ...form, deliveredAt: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Vencimiento EPP</label><input type="date" className={inputCls} value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Recibió (firma)</label><input className={inputCls} value={form.receivedBy} onChange={e => setForm({ ...form, receivedBy: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Entregó</label><input className={inputCls} value={form.deliveredBy} onChange={e => setForm({ ...form, deliveredBy: e.target.value })} /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Notas</label><textarea rows={2} className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Exámenes médicos (ISO 45001 §9.1.1) ──────────────────────

function ExamsSection() {
  const [items, setItems] = useState<MedicalExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeName: '', examType: 'PERIODIC', examDate: new Date().toISOString().split('T')[0], result: 'PENDING', restrictions: '', nextExamDate: '', performedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ items: MedicalExam[] }>('/sst/medical-exams'); setItems(r?.items || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/sst/medical-exams', {
        method: 'POST',
        json: { ...form, restrictions: form.restrictions || null, nextExamDate: form.nextExamDate || null, performedBy: form.performedBy || null, notes: form.notes || null },
      });
      setShowModal(false);
      setForm({ employeeName: '', examType: 'PERIODIC', examDate: new Date().toISOString().split('T')[0], result: 'PENDING', restrictions: '', nextExamDate: '', performedBy: '', notes: '' });
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar examen?')) return;
    await apiFetch(`/sst/medical-exams/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Exámenes médicos ocupacionales — ISO 45001 §9.1.1</p>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Registrar examen
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Trabajador</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Próximo</th><th className="px-4 py-3">Médico</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin exámenes registrados</td></tr>}
            {items.map(m => {
              const r = EXAM_RESULTS[m.result];
              return (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.employeeName || '—'}</td>
                  <td className="px-4 py-3">{EXAM_TYPES[m.examType] || m.examType}</td>
                  <td className="px-4 py-3">{fmtDate(m.examDate)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r?.cls || 'bg-gray-100'}`} title={m.restrictions || ''}>{r?.label || m.result}</span></td>
                  <td className="px-4 py-3">
                    {m.nextExamDate
                      ? <span className={isOverdue(m.nextExamDate) ? 'font-medium text-red-600' : ''}>{fmtDate(m.nextExamDate)}{isOverdue(m.nextExamDate) && ' ⚠'}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">{m.performedBy || '—'}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => remove(m.id)} className="rounded p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="w-full max-w-lg rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Registrar examen médico</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Trabajador *</label><input required className={inputCls} value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
                <select className={inputCls} value={form.examType} onChange={e => setForm({ ...form, examType: e.target.value })}>
                  {Object.entries(EXAM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Fecha *</label><input required type="date" className={inputCls} value={form.examDate} onChange={e => setForm({ ...form, examDate: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Resultado *</label>
                <select className={inputCls} value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>
                  {Object.entries(EXAM_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Próximo examen</label><input type="date" className={inputCls} value={form.nextExamDate} onChange={e => setForm({ ...form, nextExamDate: e.target.value })} /></div>
              {form.result === 'FIT_WITH_RESTRICTIONS' && (
                <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Restricciones</label><textarea rows={2} className={inputCls} value={form.restrictions} onChange={e => setForm({ ...form, restrictions: e.target.value })} /></div>
              )}
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Médico / centro</label><input className={inputCls} value={form.performedBy} onChange={e => setForm({ ...form, performedBy: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Notas</label><input className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
