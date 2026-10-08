'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Loader2, Paperclip, Ban, DollarSign, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { fmtMoney, fmtFecha, ESTADO_FACTURA } from './fmt';

type Factura = {
  id: string; numero: string | null; puntoVenta: string | null; tipoComprobante: string;
  fechaEmision: string; fechaVencimiento: string | null; clienteId: string | null; clienteNombre: string;
  neto: number; iva: number; total: number; moneda: string; estado: string;
  cobrado: number; saldo: number; diasAtraso: number;
  fileUrl: string | null; fileName: string | null; centroCostoId: string | null;
  notas: string | null; cobros: any[]; items: any[];
};

type FormState = {
  numero: string; puntoVenta: string; tipoComprobante: string; fechaEmision: string;
  fechaVencimiento: string; clienteId: string; clienteNombre: string; neto: string;
  iva: string; total: string; moneda: string; centroCostoId: string; notas: string;
};

const emptyForm: FormState = {
  numero: '', puntoVenta: '', tipoComprobante: 'FACTURA', fechaEmision: new Date().toISOString().slice(0, 10),
  fechaVencimiento: '', clienteId: '', clienteNombre: '', neto: '', iva: '', total: '',
  moneda: 'ARS', centroCostoId: '', notas: '',
};

export default function Facturacion({ centros, onChanged }: { centros: any[]; onChanged: () => void }) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cobroForm, setCobroForm] = useState<{ facturaId: string; importe: string; fecha: string; medioPago: string; referencia: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ url: string; name: string; mimeType: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = filtroEstado ? `?estado=${filtroEstado}` : '';
      const d = await apiFetch<{ facturas: Factura[] }>(`/finanzas/facturas${q}`);
      setFacturas(d.facturas);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filtroEstado]);
  useEffect(() => {
    apiFetch<any>('/customers?limit=500').then(d => setClientes(d.customers || d || [])).catch(() => {});
  }, []);

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const pickCliente = (id: string) => {
    const c = clientes.find((x: any) => x.id === id);
    setForm(f => ({ ...f, clienteId: id, clienteNombre: c ? (c.razonSocial || c.name || c.nombre || '') : f.clienteNombre }));
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch<{ url: string; name: string; mimeType: string }>('/finanzas/facturas/upload', { method: 'POST', body: fd });
    setFileData(res);
  };

  const guardar = async () => {
    setError(null);
    if (!form.clienteNombre.trim()) return setError('El cliente es obligatorio');
    if (!Number(form.total)) return setError('El total es obligatorio');
    setSaving(true);
    try {
      await apiFetch('/finanzas/facturas', {
        method: 'POST',
        json: {
          numero: form.numero || null, puntoVenta: form.puntoVenta || null,
          tipoComprobante: form.tipoComprobante, fechaEmision: form.fechaEmision,
          fechaVencimiento: form.fechaVencimiento || null,
          clienteId: form.clienteId || null, clienteNombre: form.clienteNombre,
          neto: Number(form.neto) || 0, iva: Number(form.iva) || 0, total: Number(form.total),
          moneda: form.moneda, centroCostoId: form.centroCostoId || null,
          notas: form.notas || null,
          fileUrl: fileData?.url || null, fileName: fileData?.name || null, mimeType: fileData?.mimeType || null,
        },
      });
      setForm(emptyForm); setFileData(null); setShowForm(false);
      await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const registrarCobro = async () => {
    if (!cobroForm) return;
    try {
      await apiFetch(`/finanzas/facturas/${cobroForm.facturaId}/cobros`, {
        method: 'POST',
        json: { importe: Number(cobroForm.importe), fecha: cobroForm.fecha, medioPago: cobroForm.medioPago || null, referencia: cobroForm.referencia || null },
      });
      setCobroForm(null); await load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al registrar cobro'); }
  };

  const anular = async (f: Factura) => {
    if (!window.confirm(`¿Anular la factura de ${f.clienteNombre} por ${fmtMoney(f.total, f.moneda)}?`)) return;
    await apiFetch(`/finanzas/facturas/${f.id}/anular`, { method: 'POST' });
    await load(); onChanged();
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={`${inputCls} w-44`}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_FACTURA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
          <Plus size={15} /> Nueva factura
        </button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Nueva factura emitida</span>
            <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Cliente</label>
              <select value={form.clienteId} onChange={e => pickCliente(e.target.value)} className={inputCls}>
                <option value="">— Seleccionar o escribir —</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.razonSocial || c.name || c.nombre}</option>)}
              </select>
              <input value={form.clienteNombre} onChange={e => set('clienteNombre', e.target.value)} placeholder="Razón social" className={`${inputCls} mt-1.5`} />
            </div>
            <div><label className={labelCls}>Tipo</label>
              <select value={form.tipoComprobante} onChange={e => set('tipoComprobante', e.target.value)} className={inputCls}>
                <option value="FACTURA">Factura</option><option value="NOTA_CREDITO">Nota de crédito</option>
                <option value="BOLETA">Boleta</option><option value="OTRO">Otro</option>
              </select>
            </div>
            <div><label className={labelCls}>Pto. venta</label><input value={form.puntoVenta} onChange={e => set('puntoVenta', e.target.value)} placeholder="0001" className={inputCls} /></div>
            <div><label className={labelCls}>Número</label><input value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="00000001" className={inputCls} /></div>
            <div><label className={labelCls}>Emisión</label><input type="date" value={form.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Vencimiento</label><input type="date" value={form.fechaVencimiento} onChange={e => set('fechaVencimiento', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Neto</label><input type="number" value={form.neto} onChange={e => set('neto', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>IVA</label><input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Total *</label><input type="number" value={form.total} onChange={e => set('total', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className={inputCls}>
                <option>ARS</option><option>CLP</option><option>USD</option>
              </select>
            </div>
            <div><label className={labelCls}>Centro de costo</label>
              <select value={form.centroCostoId} onChange={e => set('centroCostoId', e.target.value)} className={inputCls}>
                <option value="">—</option>
                {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Comprobante (PDF/imagen)</label>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-neutral-400">
                <Paperclip size={14} />{fileData ? fileData.name : 'Adjuntar archivo'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </div>
            <div className="col-span-2 lg:col-span-4"><label className={labelCls}>Notas</label><input value={form.notas} onChange={e => set('notas', e.target.value)} className={inputCls} /></div>
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
                <th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Comprobante</th><th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Cobrado</th><th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => {
                const st = ESTADO_FACTURA[f.estado] || ESTADO_FACTURA.EMITIDA;
                const open = expandId === f.id;
                return (
                  <>
                    <tr key={f.id} className="border-b border-neutral-100 hover:bg-neutral-50/60 cursor-pointer" onClick={() => setExpandId(open ? null : f.id)}>
                      <td className="px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(f.fechaEmision)}</td>
                      <td className="px-4 py-2.5 font-medium text-neutral-900">{f.clienteNombre}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{[f.puntoVenta, f.numero].filter(Boolean).join('-') || f.tipoComprobante}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(f.total, f.moneda)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(f.cobrado, f.moneda)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                        {f.estado === 'VENCIDA' && f.diasAtraso > 0 && <span className="ml-1 text-[10px] text-red-500">+{f.diasAtraso}d</span>}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                    </tr>
                    {open && (
                      <tr key={f.id + '-x'} className="border-b border-neutral-100 bg-neutral-50/50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="min-w-56 flex-1">
                              <div className="text-[11px] font-medium uppercase text-neutral-400">Cobros</div>
                              {f.cobros?.length ? f.cobros.map((c: any) => (
                                <div key={c.id} className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                                  <span>{fmtFecha(c.fecha)}</span><span className="font-medium text-emerald-700">{fmtMoney(c.importe, c.moneda)}</span>
                                  {c.medioPago && <span className="text-neutral-400">{c.medioPago}</span>}
                                  <button onClick={async () => { await apiFetch(`/finanzas/cobros/${c.id}`, { method: 'DELETE' }); await load(); onChanged(); }} className="text-neutral-300 hover:text-red-500"><Trash2 size={12} /></button>
                                </div>
                              )) : <div className="mt-1 text-xs text-neutral-400">Sin cobros registrados — saldo {fmtMoney(f.saldo, f.moneda)}</div>}
                              {f.fileUrl && <a href={f.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Paperclip size={11} />{f.fileName || 'Ver comprobante'}</a>}
                            </div>
                            <div className="flex flex-col gap-2">
                              {f.estado !== 'ANULADA' && f.saldo > 0 && (
                                cobroForm?.facturaId === f.id ? (
                                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                                    <input type="number" value={cobroForm.importe} onChange={e => setCobroForm({ ...cobroForm, importe: e.target.value })} placeholder="Importe" className="w-28 rounded border border-neutral-200 px-2 py-1 text-xs" />
                                    <input type="date" value={cobroForm.fecha} onChange={e => setCobroForm({ ...cobroForm, fecha: e.target.value })} className="rounded border border-neutral-200 px-2 py-1 text-xs" />
                                    <select value={cobroForm.medioPago} onChange={e => setCobroForm({ ...cobroForm, medioPago: e.target.value })} className="rounded border border-neutral-200 px-2 py-1 text-xs">
                                      <option value="">Medio</option><option>TRANSFERENCIA</option><option>EFECTIVO</option><option>CHEQUE</option><option>OTRO</option>
                                    </select>
                                    <button onClick={registrarCobro} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">Confirmar</button>
                                    <button onClick={() => setCobroForm(null)} className="text-xs text-neutral-400">Cancelar</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setCobroForm({ facturaId: f.id, importe: String(f.saldo), fecha: new Date().toISOString().slice(0, 10), medioPago: '', referencia: '' })}
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
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {facturas.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-400">Sin facturas emitidas en el período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
