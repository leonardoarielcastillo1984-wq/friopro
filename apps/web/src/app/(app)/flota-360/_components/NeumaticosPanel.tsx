'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CircleDot, Plus, X, ArrowDownToLine, ArrowUpFromLine, Gauge, Repeat, Ruler, TrendingDown } from 'lucide-react';

type Posicion = {
  id: string; eje: number; lado: 'IZQ' | 'DER'; posicion: 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO';
  kmAlMontar: number | null; montadoAt: string;
  neumatico: { id: string; codigo: string; marca: string | null; medida: string | null; profBanda: number | null; kmAcumulados: number | null; status: string; presionRecomendada: number | null } | null;
  ultimaPresion?: { presionMedida: number; fecha: string } | null;
};

type NeumaticoLibre = { id: string; codigo: string; marca: string | null; medida: string | null; status: string };

function profColor(p: number | null | undefined) {
  if (p == null) return 'text-neutral-400';
  if (p >= 6) return 'text-green-600';
  if (p >= 3) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Panel de neumáticos de la ficha del vehículo:
 * diagrama de posiciones por eje + montar / desmontar / registrar presión.
 */
export default function NeumaticosPanel({ vehiculoId, odometro }: { vehiculoId: string; odometro: number | null }) {
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [libres, setLibres] = useState<NeumaticoLibre[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [montar, setMontar] = useState({ abierto: false, neumaticoId: '', eje: 1, lado: 'IZQ' as const, posicion: 'SIMPLE' as 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO' });
  const [presion, setPresion] = useState<{ abierto: boolean; pos: Posicion | null; valor: string }>({ abierto: false, pos: null, valor: '' });
  const [rotar, setRotar] = useState<{ abierto: boolean; pos: Posicion | null; eje: number; lado: 'IZQ' | 'DER'; posicion: 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO'; notas: string }>({ abierto: false, pos: null, eje: 1, lado: 'IZQ', posicion: 'SIMPLE', notas: '' });
  const [medicion, setMedicion] = useState<{ abierto: boolean; pos: Posicion | null; banda: string; presion: string }>({ abierto: false, pos: null, banda: '', presion: '' });
  const [curva, setCurva] = useState<{ abierto: boolean; neumaticoId: string | null; codigo: string; mediciones: any[] }>({ abierto: false, neumaticoId: null, codigo: '', mediciones: [] });

  const load = async () => {
    setLoading(true);
    try {
      const [d, n] = await Promise.all([
        apiFetch<{ posiciones: Posicion[] }>(`/flota/vehiculos/${vehiculoId}/diagrama`),
        apiFetch<{ neumaticos: NeumaticoLibre[] }>('/flota/neumaticos'),
      ]);
      setPosiciones(d.posiciones || []);
      setLibres((n.neumaticos || []).filter((x) => x.status === 'DISPONIBLE'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehiculoId]);

  const ejes = [...new Set(posiciones.filter((p) => p.posicion !== 'AUXILIO').map((p) => p.eje))].sort((a, b) => a - b);
  const auxilios = posiciones.filter((p) => p.posicion === 'AUXILIO');
  const maxEje = Math.max(2, ...ejes, montar.eje);

  const posDe = (eje: number, lado: string, posicion: string) =>
    posiciones.find((p) => p.eje === eje && p.lado === lado && p.posicion === posicion);

  const montarNeumatico = async () => {
    if (!montar.neumaticoId) { setError('Elegí un neumático'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/neumaticos/${montar.neumaticoId}/montar`, {
        method: 'POST',
        json: { vehiculoId, eje: Number(montar.eje), lado: montar.lado, posicion: montar.posicion, kmAlMontar: odometro ?? undefined },
      });
      setMontar({ abierto: false, neumaticoId: '', eje: 1, lado: 'IZQ', posicion: 'SIMPLE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo montar');
    } finally {
      setBusy(false);
    }
  };

  const desmontar = async (p: Posicion) => {
    if (!p.neumatico) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/neumaticos/${p.neumatico.id}/desmontar`, {
        method: 'POST',
        json: { kmAlDesmontar: odometro ?? undefined },
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo desmontar');
    } finally {
      setBusy(false);
    }
  };

  const rotarNeumatico = async () => {
    const p = rotar.pos;
    if (!p?.neumatico) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/neumaticos/${p.neumatico.id}/rotar`, {
        method: 'POST',
        json: { ejeDestino: Number(rotar.eje), ladoDestino: rotar.lado, posDestino: rotar.posicion, kmAlRotar: odometro ?? undefined, notas: rotar.notas || undefined },
      });
      setRotar({ abierto: false, pos: null, eje: 1, lado: 'IZQ', posicion: 'SIMPLE', notas: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo rotar');
    } finally {
      setBusy(false);
    }
  };

  const guardarPresion = async () => {
    const p = presion.pos;
    if (!p?.neumatico || !presion.valor) return;
    setBusy(true);
    try {
      await apiFetch(`/flota/neumaticos/${p.neumatico.id}/presion`, {
        method: 'POST',
        json: { vehiculoId, eje: p.eje, lado: p.lado, posicion: p.posicion, presionMedida: Number(presion.valor) },
      });
      setPresion({ abierto: false, pos: null, valor: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la presión');
    } finally {
      setBusy(false);
    }
  };

  const guardarMedicion = async () => {
    const p = medicion.pos;
    if (!p?.neumatico || !medicion.banda) return;
    setBusy(true);
    try {
      await apiFetch(`/flota/neumaticos/${p.neumatico.id}/medicion`, {
        method: 'POST',
        json: {
          profBanda: Number(medicion.banda),
          kmAlMedir: odometro ?? undefined,
          presion: medicion.presion ? Number(medicion.presion) : undefined,
          vehiculoId, eje: p.eje, lado: p.lado, posicion: p.posicion,
        },
      });
      setMedicion({ abierto: false, pos: null, banda: '', presion: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la medición');
    } finally {
      setBusy(false);
    }
  };

  const verCurva = async (p: Posicion) => {
    if (!p.neumatico) return;
    try {
      const r = await apiFetch<{ mediciones: any[] }>(`/flota/neumaticos/${p.neumatico.id}/mediciones`);
      setCurva({ abierto: true, neumaticoId: p.neumatico.id, codigo: p.neumatico.codigo, mediciones: r.mediciones || [] });
    } catch {
      setCurva({ abierto: true, neumaticoId: p.neumatico.id, codigo: p.neumatico.codigo, mediciones: [] });
    }
  };

  const celda = (eje: number, lado: 'IZQ' | 'DER', posicion: 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO') => {
    const p = posDe(eje, lado, posicion);
    const n = p?.neumatico;
    return (
      <div key={`${eje}-${lado}-${posicion}`} className={`min-w-[92px] rounded-md border px-2 py-1.5 text-center ${n ? 'border-neutral-300 bg-white' : 'border-dashed border-neutral-200 bg-neutral-50'}`}>
        {n ? (
          <>
            <p className="text-[11px] font-semibold text-neutral-800">{n.codigo}</p>
            <p className={`text-[10px] font-medium ${profColor(n.profBanda)}`}>{n.profBanda != null ? `${n.profBanda} mm` : 'sin banda'}</p>
            {p?.ultimaPresion && <p className="text-[10px] text-neutral-400">{p.ultimaPresion.presionMedida} psi</p>}
            <div className="mt-1 flex justify-center gap-1">
              <button title="Medir banda" disabled={busy} onClick={() => setMedicion({ abierto: true, pos: p!, banda: '', presion: '' })} className="text-emerald-500 hover:text-emerald-700"><Ruler className="h-3 w-3" /></button>
              <button title="Curva de desgaste" disabled={busy} onClick={() => verCurva(p!)} className="text-amber-500 hover:text-amber-700"><TrendingDown className="h-3 w-3" /></button>
              <button title="Registrar presión" disabled={busy} onClick={() => setPresion({ abierto: true, pos: p!, valor: '' })} className="text-blue-500 hover:text-blue-700"><Gauge className="h-3 w-3" /></button>
              <button title="Rotar a otra posición" disabled={busy} onClick={() => setRotar({ abierto: true, pos: p!, eje: p!.eje, lado: p!.lado, posicion: p!.posicion, notas: '' })} className="text-violet-500 hover:text-violet-700"><Repeat className="h-3 w-3" /></button>
              <button title="Desmontar" disabled={busy} onClick={() => desmontar(p!)} className="text-red-400 hover:text-red-600"><ArrowUpFromLine className="h-3 w-3" /></button>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-neutral-300 py-2">vacía</p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-blue-600" /> Neumáticos montados</span>
        <button onClick={() => setMontar({ ...montar, abierto: true })} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
          <ArrowDownToLine className="h-3 w-3" /> Montar
        </button>
      </div>

      {error && <p className="mx-3 mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}

      <div className="p-3">
        {loading ? (
          <p className="text-xs text-neutral-400 py-3 text-center">Cargando posiciones…</p>
        ) : posiciones.length === 0 ? (
          <p className="text-xs text-neutral-400 py-3 text-center">Sin neumáticos montados — usá "Montar" para asignar posiciones</p>
        ) : (
          <div className="space-y-2">
            {ejes.map((eje) => (
              <div key={eje} className="flex items-center gap-2">
                <span className="w-12 text-[10px] font-semibold text-neutral-400 uppercase">Eje {eje}</span>
                <div className="flex gap-1.5">{(['EXT', 'INT'] as const).map((pos) => celda(eje, 'IZQ', pos))}{celda(eje, 'IZQ', 'SIMPLE')}</div>
                <div className="flex-1 border-t border-dashed border-neutral-200" />
                <div className="flex gap-1.5">{celda(eje, 'DER', 'SIMPLE')}{(['INT', 'EXT'] as const).map((pos) => celda(eje, 'DER', pos))}</div>
              </div>
            ))}
            {auxilios.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-dashed border-neutral-200">
                <span className="w-12 text-[10px] font-semibold text-neutral-400 uppercase">Auxilio</span>
                <div className="flex gap-1.5">{auxilios.map((p) => celda(p.eje, p.lado, 'AUXILIO'))}</div>
              </div>
            )}
            <p className="text-[10px] text-neutral-400">Izquierda / derecha según sentido de marcha · SIMPLE = rueda única, EXT/INT = doble · AUXILIO = rueda de auxilio</p>
          </div>
        )}
      </div>

      {/* Modal montar */}
      {montar.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Montar neumático</h3>
              <button onClick={() => setMontar({ ...montar, abierto: false })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Neumático disponible *</label>
                <select value={montar.neumaticoId} onChange={(e) => setMontar({ ...montar, neumaticoId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {libres.map((n) => <option key={n.id} value={n.id}>{n.codigo} · {n.marca || ''} {n.medida || ''}</option>)}
                </select>
                {libres.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No hay neumáticos disponibles en depósito.{' '}
                    <Link href="/flota-360/neumaticos" className="font-medium text-blue-600 hover:underline">Crear neumático →</Link>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Eje</label>
                  <input type="number" min={1} max={8} value={montar.eje} onChange={(e) => setMontar({ ...montar, eje: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Lado</label>
                  <select value={montar.lado} onChange={(e) => setMontar({ ...montar, lado: e.target.value as any })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="IZQ">Izq</option><option value="DER">Der</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Posición</label>
                  <select value={montar.posicion} onChange={(e) => setMontar({ ...montar, posicion: e.target.value as any, eje: e.target.value === 'AUXILIO' ? 0 : montar.eje })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="SIMPLE">Simple</option><option value="EXT">Ext</option><option value="INT">Int</option><option value="AUXILIO">Auxilio</option>
                  </select>
                </div>
              </div>
              {montar.posicion !== 'AUXILIO' && posDe(montar.eje, montar.lado, montar.posicion) && (
                <p className="text-[11px] text-amber-600">Esa posición está ocupada — al montar se desmonta el neumático actual.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setMontar({ ...montar, abierto: false })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy || !montar.neumaticoId} onClick={montarNeumatico} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Montando…' : 'Montar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rotar */}
      {rotar.abierto && rotar.pos?.neumatico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Rotar — {rotar.pos.neumatico.codigo}</h3>
              <button onClick={() => setRotar({ ...rotar, abierto: false })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-neutral-500">Origen: Eje {rotar.pos.eje} · {rotar.pos.lado} · {rotar.pos.posicion}</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Eje destino</label>
                  <input type="number" min={1} max={8} value={rotar.eje} onChange={(e) => setRotar({ ...rotar, eje: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Lado</label>
                  <select value={rotar.lado} onChange={(e) => setRotar({ ...rotar, lado: e.target.value as any })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="IZQ">Izq</option><option value="DER">Der</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Posición</label>
                  <select value={rotar.posicion} onChange={(e) => setRotar({ ...rotar, posicion: e.target.value as any })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="SIMPLE">Simple</option><option value="EXT">Ext</option><option value="INT">Int</option>
                  </select>
                </div>
              </div>
              {posDe(rotar.eje, rotar.lado, rotar.posicion) && (
                <p className="text-[11px] text-amber-600">Esa posición está ocupada por {posDe(rotar.eje, rotar.lado, rotar.posicion)?.neumatico?.codigo} — desmontalo primero o elegí otra.</p>
              )}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
                <input value={rotar.notas} onChange={(e) => setRotar({ ...rotar, notas: e.target.value })} placeholder="Rotación programada 10.000 km" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              {odometro != null && <p className="text-[11px] text-neutral-400">Se registra con odómetro actual: {odometro.toLocaleString('es-AR')} km</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setRotar({ ...rotar, abierto: false })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy || !!posDe(rotar.eje, rotar.lado, rotar.posicion)} onClick={rotarNeumatico} className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">{busy ? 'Rotando…' : 'Rotar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal medición de banda */}
      {medicion.abierto && medicion.pos?.neumatico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Medir banda — {medicion.pos.neumatico.codigo}</h3>
              <button onClick={() => setMedicion({ abierto: false, pos: null, banda: '', presion: '' })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600">Profundidad de banda (mm) *</label>
                <input type="number" min={0} max={30} step="0.1" value={medicion.banda} onChange={(e) => setMedicion({ ...medicion, banda: e.target.value })} placeholder="ej: 5.2" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                <p className="text-[10px] text-neutral-400 mt-0.5">Mínimo legal: 1.6 mm · Nueva: ~8 mm</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600">Presión (psi) — opcional</label>
                <input type="number" min={0} step="0.5" value={medicion.presion} onChange={(e) => setMedicion({ ...medicion, presion: e.target.value })} placeholder={medicion.pos.neumatico.presionRecomendada ? `Recomendada: ${medicion.pos.neumatico.presionRecomendada}` : ''} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              {odometro != null && <p className="text-[11px] text-neutral-400">Se registra con odómetro: {odometro.toLocaleString('es-AR')} km</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setMedicion({ abierto: false, pos: null, banda: '', presion: '' })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy || !medicion.banda} onClick={guardarMedicion} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal curva de desgaste */}
      {curva.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Curva de desgaste — {curva.codigo}</h3>
              <button onClick={() => setCurva({ abierto: false, neumaticoId: null, codigo: '', mediciones: [] })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4">
              {curva.mediciones.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">Sin mediciones registradas — usá "Medir banda" para empezar a construir la curva</p>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {curva.mediciones.map((m: any, i: number) => (
                      <div key={m.id || i} className="flex items-center justify-between rounded-md border border-neutral-100 px-3 py-1.5 text-xs">
                        <span className="text-neutral-500">{new Date(m.fecha).toLocaleDateString('es-AR')}</span>
                        <span className={`font-semibold ${profColor(m.profBanda)}`}>{m.profBanda} mm</span>
                        <span className="text-neutral-400">{m.kmAlMedir != null ? `${Math.round(m.kmAlMedir).toLocaleString('es-AR')} km` : '—'}</span>
                      </div>
                    ))}
                  </div>
                  {curva.mediciones.length >= 2 && (() => {
                    const pts = curva.mediciones.filter((m: any) => m.kmAlMedir != null).sort((a: any, b: any) => a.kmAlMedir - b.kmAlMedir);
                    if (pts.length < 2) return null;
                    const first = pts[0], last = pts[pts.length - 1];
                    const dKm = last.kmAlMedir - first.kmAlMedir;
                    const tasa = dKm > 0 ? ((first.profBanda - last.profBanda) / dKm) * 1000 : 0;
                    const kmRest = tasa > 0 ? Math.round(((last.profBanda - 1.6) / tasa) * 1000) : null;
                    return (
                      <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
                        <p>Tasa de desgaste: <strong>{tasa.toFixed(3)} mm / 1.000 km</strong></p>
                        {kmRest != null && <p>Vida útil restante estimada: <strong>{kmRest.toLocaleString('es-AR')} km</strong></p>}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal presión */}
      {presion.abierto && presion.pos?.neumatico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Presión — {presion.pos.neumatico.codigo}</h3>
              <button onClick={() => setPresion({ abierto: false, pos: null, valor: '' })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              <label className="block text-xs font-medium text-neutral-600">Presión medida (psi)</label>
              <input type="number" min={0} step="0.5" value={presion.valor} onChange={(e) => setPresion({ ...presion, valor: e.target.value })} placeholder={presion.pos.neumatico.presionRecomendada ? `Recomendada: ${presion.pos.neumatico.presionRecomendada}` : ''} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setPresion({ abierto: false, pos: null, valor: '' })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy || !presion.valor} onClick={guardarPresion} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
