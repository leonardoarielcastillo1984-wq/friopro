'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, getCsrfToken, getTenantId } from '@/lib/api';
import { AlertOctagon, Plus, X, Trash2, Upload, ExternalLink, CheckCircle2 } from 'lucide-react';

type Multa = {
  id: string; tipo: string; descripcion: string | null; actaNumero: string | null;
  lugar: string | null; fecha: string; monto: number; fechaVtoPago: string | null;
  estado: string; pagadaAt: string | null; responsablePago: string | null;
  fileUrl: string | null; conductor?: { id: string; nombre: string } | null;
};

const ESTADO_LABEL: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADA: 'Pagada', EN_DISPUTA: 'En disputa', ANULADA: 'Anulada' };
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700', PAGADA: 'bg-green-100 text-green-700',
  EN_DISPUTA: 'bg-blue-100 text-blue-700', ANULADA: 'bg-neutral-100 text-neutral-500',
};
const TIPO_LABEL: Record<string, string> = {
  TRANSITO: 'Tránsito', ESTACIONAMIENTO: 'Estacionamiento', DOCUMENTACION: 'Documentación',
  EXCESO_VELOCIDAD: 'Exceso velocidad', OTRO: 'Otro',
};

function fmtFecha(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MultasPanel({ vehiculoId, conductores }: { vehiculoId: string; conductores: { id: string; nombre: string }[] }) {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    tipo: 'TRANSITO', descripcion: '', actaNumero: '', lugar: '', fecha: '',
    monto: '', fechaVtoPago: '', conductorId: '', responsablePago: '', notas: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ multas: Multa[] }>(`/flota/multas?vehiculoId=${vehiculoId}`);
      setMultas(r.multas || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehiculoId]);

  const guardar = async () => {
    if (!form.monto) { setError('El monto es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      let fileUrl: string | undefined, fileName: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const headers: Record<string, string> = {};
        const csrf = getCsrfToken();
        const tenantId = getTenantId();
        if (csrf) headers['x-csrf-token'] = csrf;
        if (tenantId) headers['x-tenant-id'] = tenantId;
        const res = await fetch('/api/flota/multas/upload', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: fd,
        });
        if (res.ok) { const up = await res.json(); fileUrl = up.url; fileName = up.name; }
      }
      await apiFetch('/flota/multas', {
        method: 'POST',
        json: {
          vehiculoId,
          conductorId: form.conductorId || undefined,
          tipo: form.tipo,
          descripcion: form.descripcion || undefined,
          actaNumero: form.actaNumero || undefined,
          lugar: form.lugar || undefined,
          fecha: form.fecha || undefined,
          monto: Number(form.monto),
          fechaVtoPago: form.fechaVtoPago || undefined,
          responsablePago: form.responsablePago || undefined,
          fileUrl, fileName,
          notas: form.notas || undefined,
        },
      });
      setShowModal(false);
      setForm({ tipo: 'TRANSITO', descripcion: '', actaNumero: '', lugar: '', fecha: '', monto: '', fechaVtoPago: '', conductorId: '', responsablePago: '', notas: '' });
      setFile(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la multa');
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (id: string, estado: string) => {
    try {
      await apiFetch(`/flota/multas/${id}`, { method: 'PATCH', json: { estado } });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar');
    }
  };

  const eliminar = async (id: string) => {
    try {
      await apiFetch(`/flota/multas/${id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar');
    }
  };

  const pendientes = multas.filter((m) => m.estado === 'PENDIENTE');
  const totalPendiente = pendientes.reduce((s, m) => s + m.monto, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
          <AlertOctagon className="h-3.5 w-3.5 text-red-500" /> Multas
          {pendientes.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</span>}
        </span>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
          <Plus className="h-3 w-3" /> Cargar multa
        </button>
      </div>

      {error && <p className="mx-3 mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}

      {loading ? (
        <p className="text-xs text-neutral-400 py-4 text-center">Cargando…</p>
      ) : multas.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">Sin multas registradas</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase">
              <tr>
                <th className="text-left font-medium px-3 py-2">Fecha</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-left font-medium px-3 py-2">Acta</th>
                <th className="text-left font-medium px-3 py-2">Conductor</th>
                <th className="text-right font-medium px-3 py-2">Monto</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {multas.map((m) => (
                <tr key={m.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-600">{fmtFecha(m.fecha)}</td>
                  <td className="px-3 py-2 text-neutral-700">{TIPO_LABEL[m.tipo] || m.tipo}{m.lugar && <p className="text-[10px] text-neutral-400">{m.lugar}</p>}</td>
                  <td className="px-3 py-2 text-neutral-600">{m.actaNumero || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{m.conductor?.nombre || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-neutral-800">${m.monto.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2">
                    <select value={m.estado} onChange={(e) => cambiarEstado(m.id, e.target.value)} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border-0 cursor-pointer ${ESTADO_COLOR[m.estado] || 'bg-neutral-100'}`}>
                      {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noreferrer" title="Ver acta" className="text-blue-500 hover:text-blue-700"><ExternalLink className="h-3 w-3" /></a>}
                      <button onClick={() => eliminar(m.id)} title="Eliminar" className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPendiente > 0 && (
            <div className="px-3 py-2 border-t border-neutral-100 text-[11px] text-neutral-500">
              Pendiente de pago: <strong className="text-amber-700">${totalPendiente.toLocaleString('es-AR')}</strong>
            </div>
          )}
        </>
      )}

      {/* Modal nueva multa */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><AlertOctagon className="h-4 w-4 text-red-500" /> Cargar multa</h3>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">N° acta / boleta</label>
                  <input value={form.actaNumero} onChange={(e) => setForm({ ...form, actaNumero: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Monto ($) *</label>
                  <input type="number" min={0} step="0.01" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Lugar</label>
                <input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="ej: RN9 km 45" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
                <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="ej: Exceso de velocidad" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Conductor</label>
                  <select value={form.conductorId} onChange={(e) => setForm({ ...form, conductorId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Sin asignar</option>
                    {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Paga</label>
                  <select value={form.responsablePago} onChange={(e) => setForm({ ...form, responsablePago: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Sin definir</option>
                    <option value="EMPRESA">Empresa</option>
                    <option value="CONDUCTOR">Conductor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Vencimiento de pago</label>
                <input type="date" value={form.fechaVtoPago} onChange={(e) => setForm({ ...form, fechaVtoPago: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Acta (PDF o foto)</label>
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                  <Upload className="h-3 w-3" /> {file ? file.name : 'Adjuntar acta'}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={saving || !form.monto} onClick={guardar} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar multa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
