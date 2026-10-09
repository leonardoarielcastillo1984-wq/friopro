'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Loader2, Paperclip, Ban, DollarSign, ChevronDown, ChevronUp, Trash2, Pencil, Check, Search } from 'lucide-react';
import { fmtMoney, fmtFecha, ESTADO_FACTURA, TIPO_COMPROBANTE, IVA_DEFAULT, MONEDAS, toDateInput } from './fmt';

type Factura = {
  id: string; numero: string | null; puntoVenta: string | null; tipoComprobante: string;
  fechaEmision: string; fechaVencimiento: string | null; clienteNombre: string; clienteRut: string | null;
  neto: number; iva: number; total: number; moneda: string; estado: string; origen: string;
  cobrado: number; saldo: number; diasAtraso: number;
  fileUrl: string | null; fileName: string | null; mimeType: string | null; centroCostoId: string | null;
  notas: string | null; cobros: any[];
};

const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
};

const nuevoForm = (moneda: string) => ({
  numero: '', puntoVenta: '', tipoComprobante: 'FACTURA', fechaEmision: hoy(), fechaVencimiento: sumarDias(hoy(), 30),
  clienteNombre: '', clienteRut: '', neto: '', ivaRate: String(IVA_DEFAULT[moneda] ?? 0), iva: '', total: '',
  moneda, centroCostoId: '', notas: '',
});
type Form = ReturnType<typeof nuevoForm>;

export default function Facturacion({ centros, moneda, monedas = MONEDAS, canEdit, onChanged }: { centros: any[]; moneda: string; monedas?: string[]; canEdit: boolean; onChanged: () => void }) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<{ nombre: string; rut: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(nuevoForm(moneda));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [cobroForm, setCobroForm] = useState<{ facturaId: string; cobroId?: string; importe: string; fecha: string; medioPago: string; referencia: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ moneda });
      if (filtroEstado && filtroEstado !== 'VENCIDA') params.set('estado', filtroEstado);
      const d = await apiFetch<{ facturas: Factura[] }>(`/finanzas/facturas?${params}`);
      setFacturas(d.facturas.map(f => ({ ...f, neto: Number(f.neto), iva: Number(f.iva), total: Number(f.total) })));
    } catch (e: any) { setError(e?.message || 'No se pudieron cargar las facturas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filtroEstado, moneda]);
  useEffect(() => { apiFetch<{ clientes: any[] }>('/finanzas/clientes').then(d => setClientes(d.clientes)).catch(() => {}); }, []);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return facturas.filter(f =>
      (filtroEstado !== 'VENCIDA' || f.estado === 'VENCIDA') &&
      (!q || f.clienteNombre.toLowerCase().includes(q) || (f.numero || '').includes(q) || (f.clienteRut || '').includes(q)));
  }, [facturas, buscar, filtroEstado]);
  const tot = visibles.reduce((t, f) => {
    const s = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
    return { neto: t.neto + s * (f.neto || f.total), total: t.total + s * f.total, saldo: t.saldo + (s > 0 ? f.saldo : 0) };
  }, { neto: 0, total: 0, saldo: 0 });

  // Cálculo automático: neto + tasa → IVA y total; o total + tasa → neto
  const setNeto = (v: string) => setForm(f => {
    const n = Number(v) || 0, r = Number(f.ivaRate) || 0, iva = Math.round(n * r) / 100;
    return { ...f, neto: v, iva: v ? String(iva) : '', total: v ? String(Math.round((n + iva) * 100) / 100) : '' };
  });
  const setRate = (v: string) => setForm(f => {
    const n = Number(f.neto) || 0, r = Number(v) || 0, iva = Math.round(n * r) / 100;
    return { ...f, ivaRate: v, iva: f.neto ? String(iva) : f.iva, total: f.neto ? String(Math.round((n + iva) * 100) / 100) : f.total };
  });
  const setTotal = (v: string) => setForm(f => {
    const t = Number(v) || 0, r = Number(f.ivaRate) || 0, n = Math.round((t / (1 + r / 100)) * 100) / 100;
    return { ...f, total: v, neto: v ? String(n) : '', iva: v ? String(Math.round((t - n) * 100) / 100) : '' };
  });
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const pickCliente = (nombre: string) => {
    const c = clientes.find(x => x.nombre === nombre);
    setForm(f => ({ ...f, clienteNombre: nombre, clienteRut: c?.rut || f.clienteRut }));
  };

  const abrirNuevo = () => { setEditId(null); setForm(nuevoForm(moneda)); setFileData(null); setShowForm(true); setError(null); };
  const abrirEditar = (f: Factura) => {
    const rate = f.neto > 0 ? Math.round((f.iva / f.neto) * 1000) / 10 : 0;
    setEditId(f.id);
    setForm({
      numero: f.numero || '', puntoVenta: f.puntoVenta || '', tipoComprobante: f.tipoComprobante,
      fechaEmision: toDateInput(f.fechaEmision), fechaVencimiento: toDateInput(f.fechaVencimiento),
      clienteNombre: f.clienteNombre, clienteRut: f.clienteRut || '', neto: f.neto ? String(f.neto) : '',
      ivaRate: String(rate), iva: f.iva ? String(f.iva) : '', total: String(f.total), moneda: f.moneda,
      centroCostoId: f.centroCostoId || '', notas: f.notas || '',
    });
    setFileData(f.fileUrl ? { url: f.fileUrl, name: f.fileName || 'comprobante', mimeType: f.mimeType || '' } : null);
    setShowForm(true); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    try { setFileData(await apiFetch('/finanzas/facturas/upload', { method: 'POST', body: fd })); }
    catch (e: any) { setError(e?.message || 'No se pudo subir el archivo'); }
  };

  const guardar = async () => {
    setError(null);
    if (!form.clienteNombre.trim()) return setError('El cliente es obligatorio');
    if (!Number(form.total)) return setError('El total es obligatorio');
    setSaving(true);
    try {
      const json = {
        numero: form.numero || null, puntoVenta: form.puntoVenta || null, tipoComprobante: form.tipoComprobante,
        fechaEmision: form.fechaEmision, fechaVencimiento: form.fechaVencimiento || null,
        clienteNombre: form.clienteNombre.trim(), clienteRut: form.clienteRut.trim() || null,
        neto: Number(form.neto) || 0, iva: Number(form.iva) || 0, total: Number(form.total),
        moneda: form.moneda, centroCostoId: form.centroCostoId || null, notas: form.notas || null,
        fileUrl: fileData?.url || null, fileName: fileData?.name || null, mimeType: fileData?.mimeType || null,
      };
      await apiFetch(editId ? `/finanzas/facturas/${editId}` : '/finanzas/facturas', { method: editId ? 'PATCH' : 'POST', json });
      setShowForm(false); setEditId(null); setFileData(null);
      await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const guardarCobro = async () => {
    if (!cobroForm || !Number(cobroForm.importe)) return;
    try {
      const json = { importe: Number(cobroForm.importe), fecha: cobroForm.fecha, medioPago: cobroForm.medioPago || null, referencia: cobroForm.referencia || null };
      if (cobroForm.cobroId) await apiFetch(`/finanzas/cobros/${cobroForm.cobroId}`, { method: 'PATCH', json });
      else await apiFetch(`/finanzas/facturas/${cobroForm.facturaId}/cobros`, { method: 'POST', json });
      setCobroForm(null); await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al guardar el cobro'); }
  };
  const eliminarCobro = async (c: any) => {
    if (!window.confirm(`¿Eliminar el cobro del ${fmtFecha(c.fecha)} por ${fmtMoney(Number(c.importe), c.moneda)}?`)) return;
    await apiFetch(`/finanzas/cobros/${c.id}`, { method: 'DELETE' }); await load(); onChanged();
  };
  const anular = async (f: Factura) => {
    if (!window.confirm(`¿Anular la factura ${f.numero || ''} de ${f.clienteNombre}? Deja de contar como venta.`)) return;
    await apiFetch(`/finanzas/facturas/${f.id}/anular`, { method: 'POST' }); await load(); onChanged();
  };
  const eliminar = async (f: Factura) => {
    if (!window.confirm(`¿Eliminar la factura ${f.numero || ''} de ${f.clienteNombre} por ${fmtMoney(f.total, f.moneda)}? Se borran también sus cobros del resultado.`)) return;
    await apiFetch(`/finanzas/facturas/${f.id}`, { method: 'DELETE' }); await load(); onChanged();
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';
  const smallIn = 'rounded border border-neutral-200 px-2 py-1 text-xs';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-neutral-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Cliente, RUT o número…" className={`${inputCls} w-60 pl-8`} />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={`${inputCls} w-44`}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_FACTURA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {canEdit && (
          <button onClick={abrirNuevo} className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            <Plus size={15} /> Nueva factura
          </button>
        )}
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">{editId ? 'Editar factura' : 'Nueva factura emitida'}</span>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
          </div>
          <datalist id="fin-clientes">{clientes.map(c => <option key={c.nombre + c.rut} value={c.nombre} />)}</datalist>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2"><label className={labelCls}>Cliente *</label>
              <input list="fin-clientes" value={form.clienteNombre} onChange={e => pickCliente(e.target.value)} placeholder="Ej. Stellantis Chile S.A." className={inputCls} /></div>
            <div><label className={labelCls}>RUT / CUIT</label><input value={form.clienteRut} onChange={e => set('clienteRut', e.target.value)} placeholder="76.123.456-7" className={inputCls} /></div>
            <div><label className={labelCls}>Tipo</label>
              <select value={form.tipoComprobante} onChange={e => set('tipoComprobante', e.target.value)} className={inputCls}>
                {Object.entries(TIPO_COMPROBANTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className={labelCls}>Folio / número</label><input value={form.numero} onChange={e => set('numero', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Pto. venta (opcional)</label><input value={form.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Emisión</label><input type="date" value={form.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Vencimiento</label>
              <input type="date" value={form.fechaVencimiento} onChange={e => set('fechaVencimiento', e.target.value)} className={inputCls} />
              <div className="mt-1 flex gap-1">{[0, 30, 45, 60, 90].map(d => (
                <button key={d} type="button" onClick={() => set('fechaVencimiento', sumarDias(form.fechaEmision, d))} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-200">{d === 0 ? 'Contado' : `${d}d`}</button>
              ))}</div></div>
            <div><label className={labelCls}>Neto (sin IVA)</label><input type="number" value={form.neto} onChange={e => setNeto(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>IVA %</label><input type="number" value={form.ivaRate} onChange={e => setRate(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>IVA</label><input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Total *</label><input type="number" value={form.total} onChange={e => setTotal(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={inputCls}>{monedas.map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className={labelCls}>Unidad / centro de costo</label>
              <select value={form.centroCostoId} onChange={e => set('centroCostoId', e.target.value)} className={inputCls}>
                <option value="">—</option>{centros.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>
            <div className="col-span-2"><label className={labelCls}>PDF de la factura</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-1 items-center gap-2 truncate rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-neutral-400">
                  <Paperclip size={14} />{fileData ? fileData.name : 'Adjuntar PDF o imagen'}
                </button>
                {fileData && <button type="button" onClick={() => setFileData(null)} className="text-neutral-400 hover:text-red-500" title="Quitar archivo"><X size={14} /></button>}
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
                <th className="px-4 py-2.5 font-medium">Emisión</th><th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Comprobante</th><th className="px-4 py-2.5 text-right font-medium">Neto</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th><th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th><th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(f => {
                const st = ESTADO_FACTURA[f.estado] || ESTADO_FACTURA.EMITIDA;
                const open = expandId === f.id;
                const nc = f.tipoComprobante === 'NOTA_CREDITO';
                return (
                  <Fragment key={f.id}>
                    <tr className="border-b border-neutral-100 hover:bg-neutral-50/60 cursor-pointer" onClick={() => setExpandId(open ? null : f.id)}>
                      <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(f.fechaEmision)}</td>
                      <td className="px-4 py-2.5"><div className="font-medium text-neutral-900">{f.clienteNombre}</div>{f.clienteRut && <div className="text-[11px] text-neutral-400">{f.clienteRut}</div>}</td>
                      <td className="px-4 py-2.5 text-neutral-600">
                        {nc ? 'NC ' : ''}{[f.puntoVenta, f.numero].filter(Boolean).join('-') || TIPO_COMPROBANTE[f.tipoComprobante]}
                        {f.fileUrl && <a href={f.fileUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ml-1.5 inline-block text-blue-500" title="Ver PDF"><Paperclip size={12} /></a>}
                        {f.origen === 'IMPORT_RCV' && <span className="ml-1.5 rounded bg-sky-50 px-1 text-[10px] text-sky-600">SII</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right ${nc ? 'text-red-600' : ''}`}>{nc ? '−' : ''}{fmtMoney(f.neto || f.total, f.moneda)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(f.total, f.moneda)}</td>
                      <td className={`px-4 py-2.5 text-right ${f.saldo > 0 && !nc ? 'text-amber-700' : 'text-neutral-400'}`}>{nc ? '—' : fmtMoney(f.saldo, f.moneda)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                        {f.estado === 'VENCIDA' && f.diasAtraso > 0 && <span className="ml-1 text-[10px] text-red-500">+{f.diasAtraso}d</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        {canEdit && <>
                          <button onClick={() => abrirEditar(f)} className="p-1 text-neutral-400 hover:text-blue-600" title="Editar"><Pencil size={14} /></button>
                          <button onClick={() => eliminar(f)} className="p-1 text-neutral-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
                        </>}
                        <button onClick={() => setExpandId(open ? null : f.id)} className="p-1 text-neutral-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="flex flex-wrap items-start gap-6">
                            <div className="min-w-72 flex-1">
                              <div className="text-[11px] font-medium uppercase text-neutral-400">Cobros recibidos</div>
                              {f.cobros?.length ? f.cobros.map((c: any) => (
                                cobroForm?.cobroId === c.id ? (
                                  <div key={c.id} className="mt-1 flex flex-wrap items-center gap-2">
                                    <input type="number" value={cobroForm.importe} onChange={e => setCobroForm({ ...cobroForm, importe: e.target.value })} className={`${smallIn} w-28`} />
                                    <input type="date" value={cobroForm.fecha} onChange={e => setCobroForm({ ...cobroForm, fecha: e.target.value })} className={smallIn} />
                                    <select value={cobroForm.medioPago} onChange={e => setCobroForm({ ...cobroForm, medioPago: e.target.value })} className={smallIn}>
                                      <option value="">Medio</option><option>TRANSFERENCIA</option><option>EFECTIVO</option><option>CHEQUE</option><option>OTRO</option>
                                    </select>
                                    <input value={cobroForm.referencia} onChange={e => setCobroForm({ ...cobroForm, referencia: e.target.value })} placeholder="Referencia" className={`${smallIn} w-28`} />
                                    <button onClick={guardarCobro} className="text-emerald-600"><Check size={14} /></button>
                                    <button onClick={() => setCobroForm(null)} className="text-neutral-400"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <div key={c.id} className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                                    <span>{fmtFecha(c.fecha)}</span><span className="font-medium text-emerald-700">{fmtMoney(Number(c.importe), c.moneda)}</span>
                                    {c.medioPago && <span className="text-neutral-400">{c.medioPago}</span>}
                                    {c.referencia && <span className="text-neutral-400">#{c.referencia}</span>}
                                    {canEdit && <>
                                      <button onClick={() => setCobroForm({ facturaId: f.id, cobroId: c.id, importe: String(Number(c.importe)), fecha: toDateInput(c.fecha), medioPago: c.medioPago || '', referencia: c.referencia || '' })} className="text-neutral-300 hover:text-blue-600"><Pencil size={11} /></button>
                                      <button onClick={() => eliminarCobro(c)} className="text-neutral-300 hover:text-red-500"><Trash2 size={11} /></button>
                                    </>}
                                  </div>
                                )
                              )) : <div className="mt-1 text-xs text-neutral-400">Sin cobros registrados.</div>}
                              <div className="mt-2 text-xs text-neutral-500">
                                Vence {fmtFecha(f.fechaVencimiento)} · Cobrado {fmtMoney(f.cobrado, f.moneda)} · Saldo <b>{fmtMoney(f.saldo, f.moneda)}</b>
                              </div>
                              {f.notas && <div className="mt-1 text-xs text-neutral-400">{f.notas}</div>}
                            </div>
                            {canEdit && (
                              <div className="flex flex-col gap-2">
                                {!nc && f.estado !== 'ANULADA' && f.saldo > 0 && (
                                  cobroForm?.facturaId === f.id && !cobroForm.cobroId ? (
                                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                                      <input type="number" value={cobroForm.importe} onChange={e => setCobroForm({ ...cobroForm, importe: e.target.value })} placeholder="Importe" className={`${smallIn} w-28`} />
                                      <input type="date" value={cobroForm.fecha} onChange={e => setCobroForm({ ...cobroForm, fecha: e.target.value })} className={smallIn} />
                                      <select value={cobroForm.medioPago} onChange={e => setCobroForm({ ...cobroForm, medioPago: e.target.value })} className={smallIn}>
                                        <option value="">Medio</option><option>TRANSFERENCIA</option><option>EFECTIVO</option><option>CHEQUE</option><option>OTRO</option>
                                      </select>
                                      <input value={cobroForm.referencia} onChange={e => setCobroForm({ ...cobroForm, referencia: e.target.value })} placeholder="Referencia" className={`${smallIn} w-28`} />
                                      <button onClick={guardarCobro} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">Confirmar</button>
                                      <button onClick={() => setCobroForm(null)} className="text-xs text-neutral-400">Cancelar</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setCobroForm({ facturaId: f.id, importe: String(f.saldo), fecha: hoy(), medioPago: 'TRANSFERENCIA', referencia: '' })}
                                      className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                                      <DollarSign size={12} /> Registrar cobro
                                    </button>
                                  )
                                )}
                                {f.estado !== 'ANULADA' && (
                                  <button onClick={() => anular(f)} className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600">
                                    <Ban size={12} /> Anular
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {visibles.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-neutral-400">Sin facturas en {moneda}. Cargalas a mano o importalas desde el SII.</td></tr>}
            </tbody>
            {visibles.length > 0 && (
              <tfoot>
                <tr className="border-t border-neutral-200 bg-neutral-50 text-sm font-semibold">
                  <td colSpan={3} className="px-4 py-2.5 text-neutral-500">{visibles.length} comprobantes</td>
                  <td className="px-4 py-2.5 text-right">{fmtMoney(tot.neto, moneda)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtMoney(tot.total, moneda)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-700">{fmtMoney(tot.saldo, moneda)}</td>
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
