'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, Package, AlertTriangle, Check } from 'lucide-react';

export default function WorkOrderParts({ workOrderId, readOnly }: { workOrderId: string; readOnly?: boolean }) {
  const [parts, setParts] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selPart, setSelPart] = useState('');
  const [qty, setQty] = useState('1');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiFetch(`/maintenance/work-orders/${workOrderId}/parts`) as any,
        apiFetch('/maintenance/spare-parts') as any,
      ]);
      setParts(p.parts || []);
      setCatalog(c.parts || []);
    } finally { setLoading(false); }
  }, [workOrderId]);

  useEffect(() => { load(); }, [load]);

  const agregar = async () => {
    if (!selPart) return;
    setAdding(true);
    try {
      await apiFetch(`/maintenance/work-orders/${workOrderId}/parts`, {
        method: 'POST',
        json: { sparePartId: selPart, quantity: parseInt(qty) || 1 },
      });
      setSelPart(''); setQty('1');
      load();
    } catch (e: any) { alert(e?.message || 'Error asignando repuesto'); }
    finally { setAdding(false); }
  };

  const quitar = async (entryId: string) => {
    await apiFetch(`/maintenance/work-orders/${workOrderId}/parts/${entryId}`, { method: 'DELETE' });
    load();
  };

  const total = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0);

  if (loading) return <div className="text-xs text-gray-400 py-2">Cargando repuestos…</div>;

  return (
    <div className="border-t pt-4">
      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-orange-500" />Repuestos utilizados
        {parts.length > 0 && <span className="text-xs font-normal text-gray-400">({parts.length})</span>}
      </h4>

      {parts.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3">Sin repuestos asignados. Se descontarán del stock al completar la OT.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {parts.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{p.sparePart?.name}</p>
                <p className="text-xs text-gray-400">
                  {p.sparePart?.code} · {p.quantity} × ${p.unitCost.toLocaleString('es-AR')}
                  {p.stockDeducted && <span className="text-green-600 ml-1">· ✓ descontado</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-gray-700">${(p.quantity * p.unitCost).toLocaleString('es-AR')}</span>
                {!readOnly && !p.stockDeducted && (
                  <button onClick={() => quitar(p.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end text-sm font-semibold text-gray-800 pt-1">
            Total repuestos: ${total.toLocaleString('es-AR')}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <select value={selPart} onChange={e => setSelPart(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seleccionar repuesto…</option>
            {catalog.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.code ? `(${c.code})` : ''} — stock: {c.currentStock}
              </option>
            ))}
          </select>
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center" />
          <button onClick={agregar} disabled={!selPart || adding}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />{adding ? '…' : 'Agregar'}
          </button>
        </div>
      )}

      {!readOnly && parts.some((p: any) => p.sparePart && p.quantity > (p.sparePart.currentStock ?? 0) && !p.stockDeducted) && (
        <p className="flex items-center gap-1 text-xs text-amber-600 mt-2">
          <AlertTriangle className="w-3.5 h-3.5" />Algunos repuestos superan el stock disponible.
        </p>
      )}
    </div>
  );
}
