'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileText, Plus, Trash2, ExternalLink } from 'lucide-react';
import FacturaModal from './FacturaForm';

type Factura = {
  id: string; tipoComprobante: string; numero: string | null; puntoVenta: string | null;
  fecha: string; proveedor: string | null; neto: number | null; iva: number | null; total: number;
  concepto: string | null; categoria: string; fileUrl: string | null; fileName: string | null;
};

const CAT_LABEL: Record<string, string> = {
  REPARACION: 'Reparación', REPUESTO: 'Repuesto', SERVICE: 'Service',
  NEUMATICO: 'Neumático', COMBUSTIBLE: 'Combustible', OTRO: 'Otro',
};

function fmtFecha(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FacturasPanel({ vehiculoId }: { vehiculoId: string }) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ facturas: Factura[] }>(`/flota/vehiculos/${vehiculoId}/facturas`);
      setFacturas(r.facturas || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehiculoId]);

  const eliminar = async (id: string) => {
    try {
      await apiFetch(`/flota/facturas/${id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar');
    }
  };

  const totalMes = facturas
    .filter((f) => { const d = new Date(f.fecha); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })
    .reduce((s, f) => s + f.total, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-blue-600" /> Facturas y comprobantes
          {facturas.length > 0 && <span className="text-[10px] font-normal text-neutral-400">({facturas.length})</span>}
        </span>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
          <Plus className="h-3 w-3" /> Cargar factura
        </button>
      </div>

      {error && <p className="mx-3 mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}

      {loading ? (
        <p className="text-xs text-neutral-400 py-4 text-center">Cargando…</p>
      ) : facturas.length === 0 ? (
        <p className="text-xs text-neutral-400 py-4 text-center">Sin facturas cargadas — usá "Cargar factura" para registrar un gasto con comprobante</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase">
              <tr>
                <th className="text-left font-medium px-3 py-2">Fecha</th>
                <th className="text-left font-medium px-3 py-2">Comprobante</th>
                <th className="text-left font-medium px-3 py-2">Proveedor</th>
                <th className="text-left font-medium px-3 py-2">Categoría</th>
                <th className="text-right font-medium px-3 py-2">Total</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {facturas.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-600">{fmtFecha(f.fecha)}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    {f.tipoComprobante}{f.puntoVenta || f.numero ? ` ${f.puntoVenta || ''}-${f.numero || ''}` : ''}
                    {f.concepto && <p className="text-[10px] text-neutral-400">{f.concepto}</p>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{f.proveedor || '—'}</td>
                  <td className="px-3 py-2"><span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">{CAT_LABEL[f.categoria] || f.categoria}</span></td>
                  <td className="px-3 py-2 text-right font-semibold text-neutral-800">${f.total.toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {f.fileUrl && <a href={f.fileUrl} target="_blank" rel="noreferrer" title="Ver archivo" className="text-blue-500 hover:text-blue-700"><ExternalLink className="h-3 w-3" /></a>}
                      <button onClick={() => eliminar(f.id)} title="Eliminar" className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalMes > 0 && (
            <div className="px-3 py-2 border-t border-neutral-100 text-[11px] text-neutral-500">
              Total del mes: <strong className="text-neutral-800">${totalMes.toLocaleString('es-AR')}</strong>
            </div>
          )}
        </>
      )}

      {showModal && <FacturaModal vehiculoId={vehiculoId} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
