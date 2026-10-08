'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Loader2, Paperclip, Trash2, Repeat } from 'lucide-react';
import { fmtMoney, fmtFecha, CATEGORIA_GASTO } from './fmt';

type Gasto = {
  id: string; fecha: string; proveedor: string | null; concepto: string; categoria: string;
  tipoGasto: string; centroCostoId: string | null; total: number; moneda: string;
  esRecurrente: boolean; fechaDesde: string | null; fechaHasta: string | null;
  fileUrl: string | null; fileName: string | null; notas: string | null;
};

const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  OPERATIVO: { label: 'Operativo', color: 'bg-blue-50 text-blue-700' },
  ESTRUCTURA: { label: 'Estructura', color: 'bg-purple-50 text-purple-700' },
  OTRO: { label: 'Otro', color: 'bg-neutral-100 text-neutral-600' },
};

export default function Gastos({ centros, onChanged }: { centros: any[]; onChanged: () => void }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10), proveedor: '', concepto: '',
    categoria: 'OTRO', tipoGasto: 'OPERATIVO', centroCostoId: '', total: '', moneda: 'ARS',
    esRecurrente: false, fechaDesde: '', fechaHasta: '', notas: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = filtroTipo ? `?tipoGasto=${filtroTipo}` : '';
      const d = await apiFetch<{ gastos: Gasto[] }>(`/finanzas/gastos${q}`);
      setGastos(d.gastos);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filtroTipo]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch<{ url: string; name: string; mimeType: string }>('/finanzas/gastos/upload', { method: 'POST', body: fd });
    setFileData(res);
  };

  const guardar = async () => {
    setError(null);
    if (!form.concepto.trim()) return setError('El concepto es obligatorio');
    if (!Number(form.total)) return setError('El total es obligatorio');
    setSaving(true);
    try {
      await apiFetch('/finanzas/gastos', {
        method: 'POST',
        json: {
          fecha: form.fecha, proveedor: form.proveedor || null, concepto: form.concepto,
          categoria: form.categoria, tipoGasto: form.tipoGasto, centroCostoId: form.centroCostoId || null,
          total: Number(form.total), moneda: form.moneda,
          esRecurrente: form.esRecurrente,
          fechaDesde: form.esRecurrente ? (form.fechaDesde || form.fecha) : null,
          fechaHasta: form.esRecurrente && form.fechaHasta ? form.fechaHasta : null,
          notas: form.notas || null,
          fileUrl: fileData?.url || null, fileName: fileData?.name || null, mimeType: fileData?.mimeType || null,
        },
      });
      setShowForm(false); setFileData(null);
      setForm({ ...form, concepto: '', proveedor: '', total: '', notas: '', esRecurrente: false, fechaDesde: '', fechaHasta: '' });
      await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const eliminar = async (g: Gasto) => {
    if (!window.confirm(`¿Eliminar el gasto "${g.concepto}" por ${fmtMoney(g.total, g.moneda)}?`)) return;
    await apiFetch(`/finanzas/gastos/${g.id}`, { method: 'DELETE' });
    await load(); onChanged();
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={`${inputCls} w-44`}>
          <option value="">Todos los tipos</option>
          <option value="OPERATIVO">Operativo</option><option value="ESTRUCTURA">Estructura</option><option value="OTRO">Otro</option>
        </select>
        <button onClick={() => setShowForm(true)} className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          <Plus size={15} /> Nuevo gasto
        </button>
      </div>
      <p className="text-xs text-neutral-400">
        Cargá acá solo los gastos que <b>no</b> están en otro módulo (alquiler, seguros, administración, servicios generales).
        Combustible, mantenimiento, repuestos, sueldos de empleados y multas ya entran automáticamente al consolidado.
      </p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Nuevo gasto</span>
            <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2"><label className={labelCls}>Concepto *</label><input value={form.concepto} onChange={e => set('concepto', e.target.value)} placeholder="Ej. Alquiler depósito" className={inputCls} /></div>
            <div><label className={labelCls}>Proveedor</label><input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Fecha</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Categoría</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls}>
                {Object.entries(CATEGORIA_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Tipo</label>
              <select value={form.tipoGasto} onChange={e => set('tipoGasto', e.target.value)} className={inputCls}>
                <option value="OPERATIVO">Operativo</option><option value="ESTRUCTURA">Estructura (fijo mensual)</option><option value="OTRO">Otro</option>
              </select>
            </div>
            <div><label className={labelCls}>Centro de costo</label>
              <select value={form.centroCostoId} onChange={e => set('centroCostoId', e.target.value)} className={inputCls}>
                <option value="">—</option>
                {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Total *</label><input type="number" value={form.total} onChange={e => set('total', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={inputCls}>
                <option>ARS</option><option>CLP</option><option>USD</option>
              </select>
            </div>
            <div className="col-span-2 flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" checked={form.esRecurrente} onChange={e => set('esRecurrente', e.target.checked)} className="rounded" />
                Recurrente mensual
              </label>
              {form.esRecurrente && (
                <>
                  <input type="date" value={form.fechaDesde} onChange={e => set('fechaDesde', e.target.value)} className={`${inputCls} w-36`} title="Desde" />
                  <input type="date" value={form.fechaHasta} onChange={e => set('fechaHasta', e.target.value)} className={`${inputCls} w-36`} title="Hasta (vacío = indefinido)" />
                </>
              )}
            </div>
            <div>
              <label className={labelCls}>Comprobante</label>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-neutral-400">
                <Paperclip size={14} />{fileData ? fileData.name : 'Adjuntar'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="py-10 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={18} /></div> : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Concepto</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th><th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th><th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => {
                const t = TIPO_LABEL[g.tipoGasto] || TIPO_LABEL.OTRO;
                return (
                  <tr key={g.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                    <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(g.fecha)}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-neutral-900">{g.concepto}</span>
                      {g.proveedor && <span className="ml-1 text-xs text-neutral-400">— {g.proveedor}</span>}
                      {g.esRecurrente && <span title="Recurrente mensual"><Repeat size={11} className="ml-1.5 inline text-purple-500" /></span>}
                      {g.fileUrl && <a href={g.fileUrl} target="_blank" rel="noreferrer" className="ml-1.5 inline-block text-blue-500"><Paperclip size={11} /></a>}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{CATEGORIA_GASTO[g.categoria] || g.categoria}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.color}`}>{t.label}</span></td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(g.total, g.moneda)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => eliminar(g)} className="text-neutral-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {gastos.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400">Sin gastos cargados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
