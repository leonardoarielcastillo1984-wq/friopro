'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Disc, Plus, X, History, Trash2, Pencil } from 'lucide-react';

type Neumatico = {
  id: string; codigo: string; marca: string | null; medida: string | null; status: string;
  condicion: string; profBanda: number | null; kmAcumulados: number;
};

const STATUS_COLOR: Record<string, string> = {
  DISPONIBLE: 'bg-green-50 text-green-700', EN_USO: 'bg-blue-50 text-blue-700', BAJA: 'bg-red-50 text-red-600',
};

const FORM_VACIO = { codigo: '', marca: '', medida: '', dot: '', condicion: 'NUEVA', profBanda: '8', notas: '' };

export default function NeumaticosPage() {
  const [neumaticos, setNeumaticos] = useState<Neumatico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);
  const [historial, setHistorial] = useState<{ abierto: boolean; neumatico: Neumatico | null; rotaciones: any[]; posiciones: any[]; cargando: boolean }>({ abierto: false, neumatico: null, rotaciones: [], posiciones: [], cargando: false });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ neumaticos: Neumatico[] }>('/flota/neumaticos');
      setNeumaticos(res.neumaticos || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const abrirEdicion = (n: Neumatico & { dot?: string | null; notas?: string | null }) => {
    setForm({
      codigo: n.codigo, marca: n.marca || '', medida: n.medida || '',
      dot: n.dot || '', condicion: n.condicion, profBanda: n.profBanda != null ? String(n.profBanda) : '',
      notas: n.notas || '',
    });
    setEditId(n.id);
    setError(null);
    setShowNuevo(true);
  };

  const cerrarModal = () => {
    setShowNuevo(false);
    setEditId(null);
    setForm(FORM_VACIO);
    setError(null);
  };

  const crear = async () => {
    if (!form.codigo) { setError('El código es obligatorio'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        codigo: form.codigo,
        marca: form.marca || undefined,
        medida: form.medida || undefined,
        dot: form.dot || undefined,
        condicion: form.condicion,
        profBanda: form.profBanda ? Number(form.profBanda) : undefined,
        notas: form.notas || undefined,
      };
      if (editId) {
        await apiFetch(`/flota/neumaticos/${editId}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/flota/neumaticos', { method: 'POST', json: payload });
      }
      cerrarModal();
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar el neumático');
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (n: Neumatico) => {
    if (!window.confirm(`¿Eliminar el neumático ${n.codigo}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/neumaticos/${n.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el neumático');
    } finally {
      setBusy(false);
    }
  };

  const verHistorial = async (n: Neumatico) => {
    setHistorial({ abierto: true, neumatico: n, rotaciones: [], posiciones: [], cargando: true });
    try {
      const [r, h] = await Promise.all([
        apiFetch<{ rotaciones: any[] }>(`/flota/neumaticos/${n.id}/rotaciones`),
        apiFetch<{ historial: any[] }>(`/flota/neumaticos/${n.id}/historial`),
      ]);
      setHistorial({ abierto: true, neumatico: n, rotaciones: r.rotaciones || [], posiciones: h.historial || [], cargando: false });
    } catch {
      setHistorial((h) => ({ ...h, cargando: false }));
    }
  };

  const fmtPos = (eje: number, lado: string, pos: string) => `Eje ${eje} · ${lado === 'IZQ' ? 'Izq' : 'Der'} · ${pos === 'SIMPLE' ? 'Simple' : pos === 'EXT' ? 'Ext' : 'Int'}`;

  const enAlerta = neumaticos.filter((n) => (n.profBanda != null && n.profBanda < 3) || n.kmAcumulados > 80000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Neumáticos</h1>
          <p className="text-sm text-neutral-500">Montaje, rotación, presión, daños, recaps y CPK — el montaje se hace desde la ficha del vehículo</p>
        </div>
        <button onClick={() => { setForm(FORM_VACIO); setError(null); setShowNuevo(true); }} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo neumático
        </button>
      </div>

      {error && !showNuevo && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      {enAlerta.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          {enAlerta.length} neumáticos con banda baja o alto kilometraje acumulado
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Marca / Medida</th>
              <th className="text-left font-medium px-3 py-2">Condición</th>
              <th className="text-left font-medium px-3 py-2">Banda</th>
              <th className="text-left font-medium px-3 py-2">Km acumulados</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && neumaticos.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin neumáticos registrados</td></tr>}
            {neumaticos.map((n) => (
              <tr key={n.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800"><span className="flex items-center gap-1.5"><Disc className="h-3.5 w-3.5 text-neutral-400" />{n.codigo}</span></td>
                <td className="px-3 py-2 text-neutral-600">{[n.marca, n.medida].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{n.condicion}</td>
                <td className={`px-3 py-2 ${n.profBanda != null && n.profBanda < 3 ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>{n.profBanda != null ? `${n.profBanda} mm` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{Math.round(n.kmAcumulados).toLocaleString('es-AR')} km</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[n.status] || 'bg-neutral-100'}`}>{n.status}</span></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <button title="Historial y rotaciones" onClick={() => verHistorial(n)} className="p-1 text-neutral-400 hover:text-blue-600"><History className="h-4 w-4" /></button>
                    <button title="Editar neumático" onClick={() => abrirEdicion(n)} className="p-1 text-neutral-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                    {n.status === 'DISPONIBLE' && (
                      <button disabled={busy} title="Eliminar neumático" onClick={() => eliminar(n)} className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal historial / rotaciones */}
      {historial.abierto && historial.neumatico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Historial — {historial.neumatico.codigo}</h2>
              <button onClick={() => setHistorial({ ...historial, abierto: false })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {historial.cargando ? (
                <p className="text-xs text-neutral-400 text-center py-4">Cargando…</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">Rotaciones ({historial.rotaciones.length})</h3>
                    {historial.rotaciones.length === 0 ? (
                      <p className="text-xs text-neutral-400">Sin rotaciones registradas — se registran desde la ficha del vehículo (botón rotar en el diagrama).</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {historial.rotaciones.map((r: any) => (
                          <li key={r.id} className="rounded-md border border-neutral-200 px-3 py-2 text-xs">
                            <p className="font-medium text-neutral-800">{fmtPos(r.ejeOrigen, r.ladoOrigen, r.posOrigen)} → {fmtPos(r.ejeDestino, r.ladoDestino, r.posDestino)}</p>
                            <p className="text-neutral-500 mt-0.5">
                              {new Date(r.fecha).toLocaleDateString('es-AR')}
                              {r.kmAlRotar != null && ` · ${Number(r.kmAlRotar).toLocaleString('es-AR')} km`}
                              {r.notas && ` · ${r.notas}`}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-2">Posiciones / montajes ({historial.posiciones.length})</h3>
                    {historial.posiciones.length === 0 ? (
                      <p className="text-xs text-neutral-400">Nunca montado.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {historial.posiciones.map((p: any) => (
                          <li key={p.id} className="rounded-md border border-neutral-200 px-3 py-2 text-xs">
                            <p className="font-medium text-neutral-800">{p.vehiculo?.dominio || 'Vehículo'} · {fmtPos(p.eje, p.lado, p.posicion)}</p>
                            <p className="text-neutral-500 mt-0.5">
                              Montado {new Date(p.montadoAt).toLocaleDateString('es-AR')}
                              {p.kmAlMontar != null && ` a ${Number(p.kmAlMontar).toLocaleString('es-AR')} km`}
                              {p.desmontadoAt ? ` · desmontado ${new Date(p.desmontadoAt).toLocaleDateString('es-AR')}` : ' · activo'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editId ? 'Editar neumático' : 'Nuevo neumático'}</h2>
              <button onClick={cerrarModal}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Código *</label>
                  <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="NEU-001" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Condición</label>
                  <select value={form.condicion} onChange={(e) => setForm({ ...form, condicion: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="NUEVA">Nueva</option><option value="USADA">Usada</option><option value="RECAPADA">Recapada</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Marca</label>
                  <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Medida</label>
                  <input value={form.medida} onChange={(e) => setForm({ ...form, medida: e.target.value })} placeholder="295/80R22.5" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">DOT</label>
                  <input value={form.dot} onChange={(e) => setForm({ ...form, dot: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Banda (mm)</label>
                  <input type="number" min={0} step="0.1" value={form.profBanda} onChange={(e) => setForm({ ...form, profBanda: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
                <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={cerrarModal} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={crear} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
