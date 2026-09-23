'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PackageSearch, AlertTriangle, Plus, X, PackagePlus, PackageMinus, Pencil, Trash2 } from 'lucide-react';

type Parte = {
  id: string; code: string; name: string; category: string | null;
  currentStock: number; minStock: number; unitCost: number; location: string | null; supplier: string | null;
};

const FORM_VACIO = { code: '', name: '', category: '', currentStock: '', minStock: '', unitCost: '', supplier: '', location: '' };

export default function RepuestosPage() {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showNuevo, setShowNuevo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [ajuste, setAjuste] = useState<{ parte: Parte | null; cantidad: string }>({ parte: null, cantidad: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ parts: Parte[] }>('/maintenance/spare-parts');
      setPartes(res.parts || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const abrirEdicion = (p: Parte) => {
    setForm({
      code: p.code, name: p.name, category: p.category || '',
      currentStock: String(p.currentStock), minStock: String(p.minStock),
      unitCost: String(p.unitCost), supplier: p.supplier || '', location: p.location || '',
    });
    setEditId(p.id);
    setError(null);
    setShowNuevo(true);
  };

  const cerrarModal = () => {
    setShowNuevo(false);
    setEditId(null);
    setForm(FORM_VACIO);
    setError(null);
  };

  const eliminar = async (p: Parte) => {
    if (!window.confirm(`¿Eliminar el repuesto ${p.code} — "${p.name}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/spare-parts/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el repuesto');
    } finally {
      setBusy(false);
    }
  };

  const crear = async () => {
    if (!form.name) { setError('El nombre es obligatorio'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        code: form.code || undefined,
        name: form.name,
        category: form.category || undefined,
        currentStock: form.currentStock ? Number(form.currentStock) : 0,
        minStock: form.minStock ? Number(form.minStock) : 0,
        unitCost: form.unitCost ? Number(form.unitCost) : 0,
        supplier: form.supplier || undefined,
        location: form.location || undefined,
      };
      if (editId) {
        await apiFetch(`/maintenance/spare-parts/${editId}`, { method: 'PUT', json: payload });
      } else {
        await apiFetch('/maintenance/spare-parts', { method: 'POST', json: payload });
      }
      cerrarModal();
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el repuesto');
    } finally {
      setBusy(false);
    }
  };

  const aplicarAjuste = async (delta: number) => {
    const p = ajuste.parte;
    if (!p) return;
    const cant = Math.abs(Number(ajuste.cantidad) || 0);
    if (cant <= 0) { setError('Indicá una cantidad'); return; }
    const nuevo = p.currentStock + delta * cant;
    if (nuevo < 0) { setError('El stock no puede quedar negativo'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/spare-parts/${p.id}`, { method: 'PUT', json: { currentStock: nuevo } });
      setAjuste({ parte: null, cantidad: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo ajustar el stock');
    } finally {
      setBusy(false);
    }
  };

  const filtradas = partes.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));
  const bajoStock = partes.filter((p) => p.currentStock <= p.minStock);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Repuestos e inventario</h1>
          <p className="text-sm text-neutral-500">Mismo catálogo y stock que Mantenimiento — el descuento sigue ocurriendo solo al completar una OT o intervención QR</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar repuesto…" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm w-56" />
          <button onClick={() => { setForm(FORM_VACIO); setError(null); setShowNuevo(true); }} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nuevo repuesto
          </button>
        </div>
      </div>

      {error && !showNuevo && !ajuste.parte && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      {bajoStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {bajoStock.length} repuestos con stock igual o por debajo del mínimo
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Nombre</th>
              <th className="text-left font-medium px-3 py-2">Categoría</th>
              <th className="text-left font-medium px-3 py-2">Stock</th>
              <th className="text-left font-medium px-3 py-2">Costo unit.</th>
              <th className="text-left font-medium px-3 py-2">Proveedor</th>
              <th className="text-left font-medium px-3 py-2">Ubicación</th>
              <th className="text-left font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin repuestos</td></tr>}
            {filtradas.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800"><span className="flex items-center gap-1.5"><PackageSearch className="h-3.5 w-3.5 text-neutral-400" />{p.code}</span></td>
                <td className="px-3 py-2 text-neutral-700">{p.name}</td>
                <td className="px-3 py-2 text-neutral-600">{p.category || '—'}</td>
                <td className="px-3 py-2">
                  <span className={p.currentStock <= p.minStock ? 'text-red-600 font-medium' : 'text-neutral-700'}>{p.currentStock}</span>
                  <span className="text-neutral-400"> / mín. {p.minStock}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600">${p.unitCost.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-neutral-600">{p.supplier || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{p.location || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <button disabled={busy} onClick={() => { setAjuste({ parte: p, cantidad: '' }); setError(null); }} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">Ajustar</button>
                    <button disabled={busy} title="Editar repuesto" onClick={() => abrirEdicion(p)} className="p-1 text-neutral-400 hover:text-blue-600 disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
                    <button disabled={busy} title="Eliminar repuesto" onClick={() => eliminar(p)} className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo repuesto */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editId ? 'Editar repuesto' : 'Nuevo repuesto'}</h2>
              <button onClick={cerrarModal}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Código</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Auto si vacío" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">{editId ? 'Stock actual' : 'Stock inicial'}</label>
                  <input type="number" min={0} value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Stock mín.</label>
                  <input type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Costo unit. ($)</label>
                  <input type="number" min={0} step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Proveedor</label>
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Ubicación</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={cerrarModal} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={crear} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajuste de stock */}
      {ajuste.parte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Ajustar stock — {ajuste.parte.code}</h2>
              <button onClick={() => setAjuste({ parte: null, cantidad: '' })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <p className="text-xs text-neutral-500">Stock actual: <strong>{ajuste.parte.currentStock}</strong> · {ajuste.parte.name}</p>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Cantidad</label>
                <input type="number" min={1} value={ajuste.cantidad} onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => aplicarAjuste(1)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  <PackagePlus className="h-3.5 w-3.5" /> Ingresar
                </button>
                <button disabled={busy} onClick={() => aplicarAjuste(-1)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  <PackageMinus className="h-3.5 w-3.5" /> Egresar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
