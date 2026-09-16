'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Link2, Unlink, Plus, X, Truck, Container } from 'lucide-react';

type Vehiculo = { id: string; dominio: string; tipo: string; status: string };
type Conjunto = {
  id: string; estado: string; fechaAcople: string; fechaDesacople: string | null; ubicacion: string | null;
  tractor: Vehiculo; semi: Vehiculo;
};

export default function ConjuntosPage() {
  const [conjuntos, setConjuntos] = useState<Conjunto[]>([]);
  const [tractores, setTractores] = useState<Vehiculo[]>([]);
  const [semis, setSemis] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ tractorId: '', semiId: '', ubicacion: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, v] = await Promise.all([
        apiFetch<{ conjuntos: Conjunto[] }>('/fleet-ops/conjuntos'),
        apiFetch<{ vehiculos: Vehiculo[] }>('/flota/vehiculos'),
      ]);
      setConjuntos(c.conjuntos || []);
      setTractores((v.vehiculos || []).filter((x) => x.tipo !== 'SEMI'));
      setSemis((v.vehiculos || []).filter((x) => x.tipo === 'SEMI'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const acoplar = async () => {
    if (!form.tractorId || !form.semiId) { setError('Elegí tractor y semi'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/fleet-ops/conjuntos', { method: 'POST', json: form });
      setShowModal(false);
      setForm({ tractorId: '', semiId: '', ubicacion: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo acoplar');
    } finally {
      setSaving(false);
    }
  };

  const desacoplar = async (id: string) => {
    await apiFetch(`/fleet-ops/conjuntos/${id}/desacoplar`, { method: 'POST', json: {} });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Conjuntos operativos</h1>
          <p className="text-sm text-neutral-500">Acople temporal de tractor + semi, sin fusionar activos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Acoplar tractor + semi
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Tractor</th>
              <th className="text-left font-medium px-3 py-2">Semi</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Acoplado desde</th>
              <th className="text-left font-medium px-3 py-2">Ubicación</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && conjuntos.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin conjuntos operativos</td></tr>
            )}
            {conjuntos.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">
                  <Link href={`/flota-360/conjuntos/${c.id}`} className="flex items-center gap-1.5 hover:text-blue-700">
                    <Truck className="h-3.5 w-3.5 text-neutral-400" />{c.tractor.dominio}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-700 flex items-center gap-1.5"><Container className="h-3.5 w-3.5 text-neutral-400" />{c.semi.dominio}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${c.estado === 'ACOPLADO' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    <Link2 className="h-3 w-3" /> {c.estado}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{new Date(c.fechaAcople).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2 text-neutral-600">{c.ubicacion || '—'}</td>
                <td className="px-3 py-2 text-right">
                  {c.estado === 'ACOPLADO' && (
                    <button onClick={() => desacoplar(c.id)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                      <Unlink className="h-3 w-3" /> Desacoplar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Acoplar tractor + semi</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Tractor *</label>
                <select value={form.tractorId} onChange={(e) => setForm({ ...form, tractorId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {tractores.map((t) => <option key={t.id} value={t.id}>{t.dominio}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Semi *</label>
                <select value={form.semiId} onChange={(e) => setForm({ ...form, semiId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {semis.map((s) => <option key={s.id} value={s.id}>{s.dominio}</option>)}
                </select>
                {semis.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay semis cargados. Creá uno en la sección "Semis".</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Ubicación</label>
                <input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={acoplar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Acoplar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
