'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Loader2, Paperclip, Trash2, Repeat, Pencil, Search, Tags } from 'lucide-react';
import { fmtMoney, fmtFecha, CATEGORIA_GASTO, TIPO_COMPROBANTE, IVA_DEFAULT, MONEDAS, toDateInput } from './fmt';

type Gasto = {
  id: string; fecha: string; proveedor: string | null; proveedorRut: string | null; concepto: string; categoria: string;
  tipoGasto: string; centroCostoId: string | null; neto: number | null; iva: number | null; total: number; moneda: string;
  tipoComprobante: string | null; numeroComprobante: string | null; origen: string;
  ivaRecuperable?: boolean;
  esRecurrente: boolean; fechaDesde: string | null; fechaHasta: string | null;
  esAmortizable?: boolean; variacionCuota?: number | null; vehiculoId?: string | null;
  fileUrl: string | null; fileName: string | null; mimeType: string | null; notas: string | null;
};

const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  OPERATIVO: { label: 'Operativo', color: 'bg-blue-50 text-blue-700' },
  ESTRUCTURA: { label: 'Estructura', color: 'bg-purple-50 text-purple-700' },
  OTRO: { label: 'Otro', color: 'bg-neutral-100 text-neutral-600' },
};

const hoy = () => new Date().toISOString().slice(0, 10);
const nuevoForm = (moneda: string) => ({
  fecha: hoy(), proveedor: '', proveedorRut: '', concepto: '', categoria: 'OTRO', tipoGasto: 'OPERATIVO',
  centroCostoId: '', conIva: false, ivaRecuperable: true, neto: '', ivaRate: String(IVA_DEFAULT[moneda] ?? 0), iva: '', total: '', moneda,
  tipoComprobante: '', numeroComprobante: '',
  // modo: PUNTUAL | FIJO (repite igual) | CUOTA (varía por mes) | AMORTIZA (divide el total)
  modo: 'PUNTUAL' as 'PUNTUAL' | 'FIJO' | 'CUOTA' | 'AMORTIZA',
  esRecurrente: false, esAmortizable: false, variacionCuota: '', fechaDesde: '', fechaHasta: '',
  vehiculoId: '', notas: '',
});
type Form = ReturnType<typeof nuevoForm>;
// Costo real: neto solo si el IVA se recupera; si no, el impuesto es costo.
const costo = (g: Gasto) => (g.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1) * (g.ivaRecuperable !== false && g.neto !== null ? g.neto : g.total);

export default function Gastos({ centros, moneda, monedas = MONEDAS, canEdit, onChanged }: { centros: any[]; moneda: string; monedas?: string[]; canEdit: boolean; onChanged: () => void }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState<Form>(nuevoForm(moneda));
  const [showProv, setShowProv] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<{ id: string; dominio: string }[]>([]);
  const [showPres, setShowPres] = useState(false);
  const [presupuesto, setPresupuesto] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ moneda });
      if (filtroTipo) params.set('tipoGasto', filtroTipo);
      if (filtroCat) params.set('categoria', filtroCat);
      if (filtroMes) {
        const [y, m] = filtroMes.split('-').map(Number);
        params.set('desde', new Date(Date.UTC(y, m - 1, 1)).toISOString());
        params.set('hasta', new Date(Date.UTC(y, m, 1)).toISOString());
      }
      const d = await apiFetch<{ gastos: Gasto[] }>(`/finanzas/gastos?${params}`);
      setGastos(d.gastos.map(g => ({ ...g, total: Number(g.total), neto: g.neto === null ? null : Number(g.neto), iva: g.iva === null ? null : Number(g.iva) })));
    } catch (e: any) { setError(e?.message || 'No se pudieron cargar los gastos'); }
    finally { setLoading(false); }
  };
  const loadProv = () => apiFetch<{ proveedores: any[] }>('/finanzas/proveedores').then(d => setProveedores(d.proveedores)).catch(() => {});
  useEffect(() => { load(); }, [filtroTipo, filtroCat, filtroMes, moneda]);
  useEffect(() => { if (showProv) loadProv(); }, [showProv]);
  useEffect(() => {
    apiFetch<{ vehiculos: any[] }>('/flota/vehiculos').then(d => setVehiculos((d.vehiculos || []).map((v: any) => ({ id: v.id, dominio: v.dominio })))).catch(() => {});
    apiFetch<{ presupuesto?: Record<string, number> }>('/finanzas/config').then(d => setPresupuesto(d.presupuesto || {})).catch(() => {});
  }, []);
  const guardarPresupuesto = async (cat: string, valor: string) => {
    const v = valor.trim() === '' ? null : Number(valor);
    if (v !== null && (!Number.isFinite(v) || v < 0)) return;
    setPresupuesto(prev => { const n = { ...prev }; if (v === null) delete n[cat]; else n[cat] = v; return n; });
    await apiFetch('/finanzas/config', { method: 'PUT', json: { presupuesto: { [cat]: v } } }).catch(() => {});
  };

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return gastos.filter(g => !q || g.concepto.toLowerCase().includes(q) || (g.proveedor || '').toLowerCase().includes(q) || (g.proveedorRut || '').includes(q));
  }, [gastos, buscar]);
  const totalCosto = visibles.reduce((s, g) => s + costo(g), 0);

  const set = (k: keyof Form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setNeto = (v: string) => setForm(f => {
    const n = Number(v) || 0, r = Number(f.ivaRate) || 0, iva = Math.round(n * r) / 100;
    return { ...f, neto: v, iva: v ? String(iva) : '', total: v ? String(Math.round((n + iva) * 100) / 100) : '' };
  });
  const setTotal = (v: string) => setForm(f => {
    if (!f.conIva) return { ...f, total: v };
    const t = Number(v) || 0, r = Number(f.ivaRate) || 0, n = Math.round((t / (1 + r / 100)) * 100) / 100;
    return { ...f, total: v, neto: v ? String(n) : '', iva: v ? String(Math.round((t - n) * 100) / 100) : '' };
  });

  const abrirNuevo = () => { setEditId(null); setForm(nuevoForm(moneda)); setFileData(null); setShowForm(true); setError(null); };
  const abrirEditar = (g: Gasto) => {
    const conIva = g.neto !== null && g.iva !== null && g.iva > 0;
    setEditId(g.id);
    setForm({
      fecha: toDateInput(g.fecha), proveedor: g.proveedor || '', proveedorRut: g.proveedorRut || '', concepto: g.concepto,
      categoria: g.categoria, tipoGasto: g.tipoGasto, centroCostoId: g.centroCostoId || '', conIva, ivaRecuperable: g.ivaRecuperable !== false,
      neto: g.neto !== null ? String(g.neto) : '', ivaRate: conIva && g.neto ? String(Math.round(((g.iva || 0) / g.neto) * 1000) / 10) : String(IVA_DEFAULT[g.moneda] ?? 0),
      iva: g.iva !== null ? String(g.iva) : '', total: String(g.total), moneda: g.moneda,
      tipoComprobante: g.tipoComprobante || '', numeroComprobante: g.numeroComprobante || '',
      modo: g.esAmortizable ? 'AMORTIZA' : g.esRecurrente ? (g.variacionCuota ? 'CUOTA' : 'FIJO') : 'PUNTUAL',
      esRecurrente: g.esRecurrente, esAmortizable: !!g.esAmortizable, variacionCuota: g.variacionCuota ? String(g.variacionCuota) : '',
      fechaDesde: toDateInput(g.fechaDesde), fechaHasta: toDateInput(g.fechaHasta), vehiculoId: g.vehiculoId || '', notas: g.notas || '',
    });
    setFileData(g.fileUrl ? { url: g.fileUrl, name: g.fileName || 'comprobante', mimeType: g.mimeType || '' } : null);
    setShowForm(true); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    try { setFileData(await apiFetch('/finanzas/gastos/upload', { method: 'POST', body: fd })); }
    catch (e: any) { setError(e?.message || 'No se pudo subir el archivo'); }
  };

  const guardar = async () => {
    setError(null);
    if (!form.concepto.trim()) return setError('El concepto es obligatorio');
    if (!Number(form.total)) return setError('El total es obligatorio');
    setSaving(true);
    try {
      const json = {
        fecha: form.fecha, proveedor: form.proveedor.trim() || null, proveedorRut: form.proveedorRut.trim() || null,
        concepto: form.concepto.trim(), categoria: form.categoria, tipoGasto: form.tipoGasto, centroCostoId: form.centroCostoId || null,
        neto: form.conIva && form.neto ? Number(form.neto) : null, iva: form.conIva && form.iva ? Number(form.iva) : null,
        ivaRecuperable: form.conIva ? form.ivaRecuperable : true,
        total: Number(form.total), moneda: form.moneda,
        tipoComprobante: form.tipoComprobante || null, numeroComprobante: form.numeroComprobante || null,
        esRecurrente: form.modo === 'FIJO' || form.modo === 'CUOTA',
        esAmortizable: form.modo === 'AMORTIZA',
        variacionCuota: form.modo === 'CUOTA' && form.variacionCuota !== '' ? Number(form.variacionCuota) : null,
        vehiculoId: form.vehiculoId || null,
        fechaDesde: form.modo !== 'PUNTUAL' ? (form.fechaDesde || form.fecha) : null,
        fechaHasta: form.modo !== 'PUNTUAL' && form.fechaHasta ? form.fechaHasta : null,
        notas: form.notas || null,
        fileUrl: fileData?.url || null, fileName: fileData?.name || null, mimeType: fileData?.mimeType || null,
      };
      await apiFetch(editId ? `/finanzas/gastos/${editId}` : '/finanzas/gastos', { method: editId ? 'PATCH' : 'POST', json });
      setShowForm(false); setEditId(null); setFileData(null);
      await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const eliminar = async (g: Gasto) => {
    if (!window.confirm(`¿Eliminar el gasto "${g.concepto}" por ${fmtMoney(g.total, g.moneda)}?`)) return;
    await apiFetch(`/finanzas/gastos/${g.id}`, { method: 'DELETE' });
    await load(); onChanged();
  };

  const reclasificar = async (p: any, cambios: { categoria?: string; tipoGasto?: string }) => {
    try {
      const r = await apiFetch<{ actualizados: number }>('/finanzas/gastos/reclasificar', {
        method: 'POST', json: { ...(p.rut ? { proveedorRut: p.rut } : { proveedor: p.nombre }), ...cambios },
      });
      setError(null);
      await Promise.all([loadProv(), load()]); onChanged();
      if (!r.actualizados) setError('No se actualizó ningún gasto');
    } catch (e: any) { setError(e?.message || 'No se pudo reclasificar'); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Concepto, proveedor, RUT…" className={`${inputCls} w-56 pl-8`} />
        </div>
        <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={`${inputCls} w-40`} title="Filtrar por mes" />
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className={`${inputCls} w-48`}>
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIA_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={`${inputCls} w-36`}>
          <option value="">Todos los tipos</option>
          <option value="OPERATIVO">Operativo</option><option value="ESTRUCTURA">Estructura</option><option value="OTRO">Otro</option>
        </select>
        <div className="ml-auto flex gap-2">
          {canEdit && <button onClick={() => setShowPres(s => !s)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"><Tags size={14} /> Presupuesto</button>}
          {canEdit && <button onClick={() => setShowProv(s => !s)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"><Tags size={14} /> Clasificar proveedores</button>}
          {canEdit && <button onClick={abrirNuevo} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"><Plus size={15} /> Nuevo gasto</button>}
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        Cargá acá fletes, sueldos, seguros, arriendo y todo lo que no esté en otro módulo — o importalos desde el RCV de Compras del SII.
        Combustible, OTs de mantenimiento, cubiertas y multas de Flota 360 entran solos al resultado: no los repitas.
        El resultado usa el <b>neto sin IVA</b> cuando el IVA es recuperable.
      </p>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showProv && (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
            <span className="text-sm font-semibold">Clasificar por proveedor <span className="font-normal text-neutral-400">— cambia todos sus gastos y los próximos que importes</span></span>
            <button onClick={() => setShowProv(false)} className="text-neutral-400"><X size={16} /></button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {proveedores.map((p, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2"><div className="font-medium text-neutral-900">{p.nombre}</div><div className="text-[11px] text-neutral-400">{p.rut || 'sin RUT'} · {p.cantidad} gastos · {fmtMoney(p.total, moneda)}</div></td>
                    <td className="px-2 py-2 w-56">
                      <select value={p.categoria} onChange={e => reclasificar(p, { categoria: e.target.value })} className="w-full rounded border border-neutral-200 px-2 py-1 text-xs">
                        {Object.entries(CATEGORIA_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 w-36">
                      <select value={p.tipoGasto} onChange={e => reclasificar(p, { tipoGasto: e.target.value })} className="w-full rounded border border-neutral-200 px-2 py-1 text-xs">
                        <option value="OPERATIVO">Operativo</option><option value="ESTRUCTURA">Estructura</option><option value="OTRO">Otro</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {proveedores.length === 0 && <tr><td className="px-4 py-6 text-center text-neutral-400">Todavía no hay gastos con proveedor.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPres && (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
            <span className="text-sm font-semibold">Presupuesto mensual por categoría <span className="font-normal text-neutral-400">— en {moneda}; si el gasto real del mes supera el tope, dispara una alerta en Resultados</span></span>
            <button onClick={() => setShowPres(false)} className="text-neutral-400"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(CATEGORIA_GASTO).map(([k, v]) => (
              <div key={k}>
                <label className={labelCls}>{v}</label>
                <input type="number" min={0} defaultValue={presupuesto[k] ?? ''} placeholder="sin tope"
                  onBlur={e => guardarPresupuesto(k, e.target.value)}
                  className={inputCls} />
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-[11px] text-neutral-400">Se guarda al salir del campo. Vacío = sin tope. Aplica a la moneda que estás viendo.</p>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">{editId ? 'Editar gasto' : 'Nuevo gasto'}</span>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2"><label className={labelCls}>Concepto *</label><input value={form.concepto} onChange={e => set('concepto', e.target.value)} placeholder="Ej. Sueldos marzo, Seguro camiones, Flete subcontratado" className={inputCls} /></div>
            <div><label className={labelCls}>Proveedor</label><input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>RUT / CUIT proveedor</label><input value={form.proveedorRut} onChange={e => set('proveedorRut', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Fecha</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Categoría</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className={inputCls}>
                {Object.entries(CATEGORIA_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className={labelCls}>Tipo</label>
              <select value={form.tipoGasto} onChange={e => set('tipoGasto', e.target.value)} className={inputCls}>
                <option value="OPERATIVO">Operativo (varía con la operación)</option><option value="ESTRUCTURA">Estructura (fijo mensual)</option><option value="OTRO">Otro</option>
              </select></div>
            <div><label className={labelCls}>Unidad / centro de costo</label>
              <select value={form.centroCostoId} onChange={e => set('centroCostoId', e.target.value)} className={inputCls}>
                <option value="">—</option>{centros.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
            <div><label className={labelCls}>Comprobante</label>
              <select value={form.tipoComprobante} onChange={e => set('tipoComprobante', e.target.value)} className={inputCls}>
                <option value="">Sin comprobante</option>{Object.entries(TIPO_COMPROBANTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className={labelCls}>Nº comprobante</label><input value={form.numeroComprobante} onChange={e => set('numeroComprobante', e.target.value)} className={inputCls} /></div>
            <div className="col-span-2 flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" checked={form.conIva} onChange={e => set('conIva', e.target.checked)} className="rounded" />
                Tiene IVA recuperable (crédito fiscal)
              </label>
            </div>
            {form.conIva && <>
              <div><label className={labelCls}>Neto</label><input type="number" value={form.neto} onChange={e => setNeto(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>IVA %</label><input type="number" value={form.ivaRate} onChange={e => set('ivaRate', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>IVA</label><input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className={inputCls} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm text-neutral-600">
                <input type="checkbox" checked={!form.ivaRecuperable} onChange={e => set('ivaRecuperable', !e.target.checked)} className="rounded" />
                El IVA NO se recupera (computa como costo)
              </label>
            </>}
            <div><label className={labelCls}>Total *</label><input type="number" value={form.total} onChange={e => setTotal(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={inputCls}>{monedas.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className={labelCls}>Imputación mensual</label>
              <select value={form.modo} onChange={e => set('modo', e.target.value as Form['modo'])} className={inputCls}>
                <option value="PUNTUAL">Una sola vez</option>
                <option value="FIJO">Se repite igual cada mes</option>
                <option value="CUOTA">Cuota que varía (préstamo / leasing)</option>
                <option value="AMORTIZA">Se amortiza (seguro / pago anual)</option>
              </select></div>
            {form.modo !== 'PUNTUAL' && <>
              <div><label className={labelCls}>Desde</label><input type="date" value={form.fechaDesde || form.fecha} onChange={e => set('fechaDesde', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Hasta{form.modo !== 'AMORTIZA' ? ' (vacío = sin fin)' : ' *'}</label><input type="date" value={form.fechaHasta} onChange={e => set('fechaHasta', e.target.value)} className={inputCls} /></div>
            </>}
            {form.modo === 'CUOTA' &&
              <div><label className={labelCls}>Variación por cuota</label>
                <input type="number" value={form.variacionCuota} onChange={e => set('variacionCuota', e.target.value)} placeholder="ej. -15000 (baja cada mes)" className={inputCls} />
                <p className="mt-0.5 text-[10px] text-neutral-400">Mes 1 = total; cada mes siguiente suma esta variación.</p></div>}
            {form.modo === 'AMORTIZA' &&
              <div className="flex items-end pb-2 text-[11px] text-neutral-400">El total se divide en partes iguales entre los meses del rango — el resultado mensual muestra solo su porción.</div>}
            <div><label className={labelCls}>Vehículo (opcional)</label>
              <select value={form.vehiculoId} onChange={e => set('vehiculoId', e.target.value)} className={inputCls}>
                <option value="">— sin unidad</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.dominio}</option>)}
              </select>
              <p className="mt-0.5 text-[10px] text-neutral-400">Imputa el costo a la unidad (lavado, peaje…) y hereda su centro de costo.</p></div>
            <div className="col-span-2"><label className={labelCls}>Comprobante (PDF/imagen)</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center gap-2 truncate rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-neutral-400">
                  <Paperclip size={14} />{fileData ? fileData.name : 'Adjuntar'}
                </button>
                {fileData && <button type="button" onClick={() => setFileData(null)} className="text-neutral-400 hover:text-red-500"><X size={14} /></button>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} /></div>
            <div className="col-span-2"><label className={labelCls}>Notas</label><input value={form.notas} onChange={e => set('notas', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} {editId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="py-10 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={18} /></div> : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Concepto</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th><th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 text-right font-medium">Costo (neto)</th><th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(g => {
                const t = TIPO_LABEL[g.tipoGasto] || TIPO_LABEL.OTRO;
                const c = costo(g);
                return (
                  <tr key={g.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                    <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(g.fecha)}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-neutral-900">{g.concepto}</span>
                      {g.proveedor && !g.concepto.includes(g.proveedor) && <span className="ml-1 text-xs text-neutral-400">— {g.proveedor}</span>}
                      {g.esRecurrente && <span title={g.variacionCuota ? `Cuota variable (${fmtMoney(g.variacionCuota, g.moneda)}/mes)` : 'Todos los meses'}><Repeat size={11} className="ml-1.5 inline text-purple-500" /></span>}
                      {g.esAmortizable && <span title="Gasto anual amortizado: el resultado muestra su porción mensual" className="ml-1.5 rounded bg-indigo-50 px-1 text-[10px] text-indigo-600">amortizado</span>}
                      {g.vehiculoId && <span title="Imputado a unidad de flota" className="ml-1.5 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500">{vehiculos.find(v => v.id === g.vehiculoId)?.dominio || 'unidad'}</span>}
                      {g.fileUrl && <a href={g.fileUrl} target="_blank" rel="noreferrer" className="ml-1.5 inline-block text-blue-500"><Paperclip size={11} /></a>}
                      {g.origen === 'IMPORT_RCV' && <span className="ml-1.5 rounded bg-sky-50 px-1 text-[10px] text-sky-600">SII</span>}
                      {Number(g.iva) > 0 && <span title={g.ivaRecuperable === false ? 'El IVA computa como costo' : 'IVA recuperado como crédito fiscal'} className={`ml-1.5 rounded px-1 text-[10px] ${g.ivaRecuperable === false ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>IVA {g.ivaRecuperable === false ? 'al costo' : 'recuperable'}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{CATEGORIA_GASTO[g.categoria] || g.categoria}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.color}`}>{t.label}</span></td>
                    <td className={`px-4 py-2.5 text-right font-medium ${c < 0 ? 'text-green-700' : ''}`}>{fmtMoney(c, g.moneda)}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-400">{fmtMoney(g.total, g.moneda)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      {canEdit && <>
                        <button onClick={() => abrirEditar(g)} className="p-1 text-neutral-400 hover:text-blue-600" title="Editar"><Pencil size={14} /></button>
                        <button onClick={() => eliminar(g)} className="p-1 text-neutral-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
                      </>}
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-400">Sin gastos en {moneda} con estos filtros.</td></tr>}
            </tbody>
            {visibles.length > 0 && (
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50 text-sm font-semibold">
                  <td colSpan={4} className="px-4 py-2.5 text-neutral-500">{visibles.length} gastos</td>
                  <td className="px-4 py-2.5 text-right">{fmtMoney(totalCosto, moneda)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
