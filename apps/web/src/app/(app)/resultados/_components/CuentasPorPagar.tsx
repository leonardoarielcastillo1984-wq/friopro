'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, AlertTriangle, Clock, CheckCircle2, Plus, X, Building2 } from 'lucide-react';
import { fmtMoney, fmtFecha } from './fmt';

type Item = {
  id: string; origen: 'GASTO' | 'FLOTA'; proveedor: string; proveedorRut: string | null;
  comprobante: string | null; concepto: string; fechaEmision: string; fechaVencimiento: string | null;
  total: number; pagado: number; saldo: number; moneda: string; centroCostoId: string | null;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO'; diasVencimiento: number;
  categoria: string; pagadaAt?: string | null;
  pagos: { id: string; fecha: string; importe: number; moneda: string; referencia: string | null }[];
  origenUrl: string; modulo: string;
};

const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-blue-50 text-blue-700',
  PARCIAL: 'bg-amber-50 text-amber-700',
  PAGADO: 'bg-green-50 text-green-700',
  VENCIDO: 'bg-red-50 text-red-700',
};

export default function CuentasPorPagar({ moneda, centros, canEdit, onChanged }: { moneda: string; centros: any[]; canEdit: boolean; onChanged: () => void }) {
  const [data, setData] = useState<{ items: Item[]; totales: any; ranking: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [pagando, setPagando] = useState<Item | null>(null);
  const [pagoForm, setPagoForm] = useState({ importe: '', fecha: new Date().toISOString().slice(0, 10), referencia: '', medioPago: 'TRANSFERENCIA' });
  const [saving, setSaving] = useState(false);

  const centroNombre = (id: string | null) => centros.find(c => c.id === id)?.nombre || null;

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ items: Item[]; totales: any; ranking: any[] }>(`/finanzas/cuentas-por-pagar${moneda ? `?moneda=${moneda}` : ''}`)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [moneda]);

  useEffect(() => { load(); }, [load]);

  const registrarPago = async () => {
    if (!pagando || !pagoForm.importe) return;
    setSaving(true);
    try {
      if (pagando.origen === 'GASTO') {
        await apiFetch(`/finanzas/gastos/${pagando.id}/pagos`, {
          method: 'POST',
          body: JSON.stringify({ importe: Number(pagoForm.importe), fecha: pagoForm.fecha, referencia: pagoForm.referencia || null, medioPago: pagoForm.medioPago, moneda: pagando.moneda }),
        });
      } else {
        await apiFetch(`/finanzas/flota-facturas/${pagando.id}/pagar`, { method: 'POST', body: JSON.stringify({ fecha: pagoForm.fecha }) });
      }
      setPagando(null);
      setPagoForm({ importe: '', fecha: new Date().toISOString().slice(0, 10), referencia: '', medioPago: 'TRANSFERENCIA' });
      load(); onChanged();
    } finally { setSaving(false); }
  };

  const despagar = async (item: Item) => {
    if (item.origen !== 'FLOTA') return;
    await apiFetch(`/finanzas/flota-facturas/${item.id}/despagar`, { method: 'POST', body: '{}' });
    load(); onChanged();
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Cargando cuentas por pagar…</div>;
  if (!data) return <div className="py-16 text-center text-neutral-400">No se pudo cargar.</div>;

  const { items, totales, ranking } = data;
  const lista = soloPendientes ? items.filter(i => i.saldo > 0.5) : items;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total por pagar', value: fmtMoney(totales.porPagar, moneda), icon: Building2, color: 'text-neutral-700' },
          { label: 'Vencido', value: fmtMoney(totales.vencido, moneda), icon: AlertTriangle, color: totales.vencido > 0 ? 'text-red-600' : 'text-neutral-400' },
          { label: 'Vence en 7 días', value: fmtMoney(totales.vence7, moneda), icon: Clock, color: 'text-amber-600' },
          { label: 'Vence en 30 días', value: fmtMoney(totales.vence30, moneda), icon: Clock, color: 'text-blue-600' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><k.icon size={13} className={k.color} />{k.label}</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-semibold text-neutral-900">Obligaciones con proveedores</span>
            <button onClick={() => setSoloPendientes(!soloPendientes)} className={`rounded-full px-3 py-1 text-[11px] font-medium ${soloPendientes ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
              {soloPendientes ? 'Solo pendientes' : 'Todas'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2 font-medium">Proveedor</th>
                  <th className="px-4 py-2 font-medium">Concepto</th>
                  <th className="px-4 py-2 font-medium">Vence</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Origen</th>
                  {canEdit && <th className="w-20 px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {lista.map(i => (
                  <tr key={`${i.origen}-${i.id}`} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-neutral-900">{i.proveedor}</div>
                      <div className="text-[11px] text-neutral-400">{[i.comprobante, centroNombre(i.centroCostoId)].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="max-w-52 truncate px-4 py-2.5 text-neutral-700" title={i.concepto}>{i.concepto}</td>
                    <td className="px-4 py-2.5 text-neutral-700">
                      {i.fechaVencimiento ? fmtFecha(i.fechaVencimiento) : <span className="text-neutral-300">—</span>}
                      {i.saldo > 0.5 && i.diasVencimiento < 0 && <div className="text-[11px] font-medium text-red-600">venció hace {-i.diasVencimiento} días</div>}
                      {i.saldo > 0.5 && i.diasVencimiento >= 0 && i.diasVencimiento <= 7 && <div className="text-[11px] font-medium text-amber-600">en {i.diasVencimiento} días</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmtMoney(i.total, i.moneda)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-900">{fmtMoney(i.saldo, i.moneda)}</td>
                    <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_STYLE[i.estado]}`}>{i.estado}</span></td>
                    <td className="px-4 py-2.5">
                      <a href={i.origenUrl} className="text-[11px] text-blue-600 hover:underline">{i.modulo}</a>
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2.5 text-right">
                        {i.saldo > 0.5 ? (
                          <button onClick={() => { setPagando(i); setPagoForm(f => ({ ...f, importe: String(Math.round(i.saldo)) })); }}
                            className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-800">Pagar</button>
                        ) : i.origen === 'FLOTA' ? (
                          <button onClick={() => despagar(i)} className="text-[11px] text-neutral-400 hover:text-red-600">Desmarcar</button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-neutral-400">Sin obligaciones registradas. Los gastos con fecha de vencimiento o pagos parciales aparecen acá.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-neutral-900">Proveedores con mayor saldo</div>
          {ranking.length === 0 ? <div className="py-4 text-center text-xs text-neutral-400">Sin deudas pendientes.</div> : (
            <div className="space-y-2">
              {ranking.slice(0, 8).map((r: any) => (
                <div key={r.proveedor} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-neutral-700">{r.proveedor}</span>
                  <span className={`font-medium ${r.vencido > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{fmtMoney(r.saldo, moneda)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pagando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPagando(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Registrar pago</h3>
              <button onClick={() => setPagando(null)} className="text-neutral-400 hover:text-neutral-600"><X size={18} /></button>
            </div>
            <div className="mb-3 rounded-lg bg-neutral-50 p-3 text-sm">
              <div className="font-medium">{pagando.proveedor}</div>
              <div className="text-neutral-500">{pagando.concepto}</div>
              <div className="mt-1 text-xs text-neutral-400">Saldo: {fmtMoney(pagando.saldo, pagando.moneda)}</div>
              {pagando.pagos.length > 0 && <div className="mt-1 text-xs text-neutral-400">{pagando.pagos.length} pago(s) previos: {fmtMoney(pagando.pagado, pagando.moneda)}</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-neutral-600">Importe
                <input type="number" min="0" step="0.01" value={pagoForm.importe} onChange={e => setPagoForm(f => ({ ...f, importe: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-neutral-600">Fecha
                <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-neutral-600">Medio de pago
                <select value={pagoForm.medioPago} onChange={e => setPagoForm(f => ({ ...f, medioPago: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                  <option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option>
                  <option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option>
                </select></label>
              <label className="text-xs font-medium text-neutral-600">Referencia
                <input value={pagoForm.referencia} onChange={e => setPagoForm(f => ({ ...f, referencia: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" placeholder="Nº transferencia" /></label>
            </div>
            {pagando.origen === 'FLOTA' && <p className="mt-2 text-[11px] text-amber-600">Las facturas de flota se marcan como pagadas en un solo movimiento (total).</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPagando(null)} className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">Cancelar</button>
              <button onClick={registrarPago} disabled={saving || !pagoForm.importe}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Registrar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
