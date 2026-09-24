'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  CircleDot, ArrowDownToLine, ArrowUpFromLine, Gauge, Repeat, Ruler,
  X, AlertTriangle, TrendingDown, Sparkles, Move,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Gemelo visual de neumáticos — esquema cenital interactivo.
// Cada rueda es un gauge radial de profundidad de banda (verde→rojo),
// con presión, arrastre para rotar/intercambiar, y drawer de detalle
// con curva de desgaste real y proyección de vida útil.
// ═══════════════════════════════════════════════════════════════

type Posicion = {
  id: string; eje: number; lado: 'IZQ' | 'DER'; posicion: 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO';
  kmAlMontar: number | null; montadoAt: string;
  neumatico: {
    id: string; codigo: string; marca: string | null; medida: string | null;
    profBanda: number | null; profBandaOriginal: number | null; kmAcumulados: number | null;
    status: string; presionRecomendada: number | null; condicion: string; recapsCount: number;
  } | null;
  ultimaPresion?: { presionMedida: number; fecha: string } | null;
};
type Libre = { id: string; codigo: string; marca: string | null; medida: string | null };

const MIN_LEGAL = 2;   // mm — piso de vida útil (0%)
const BANDA_NUEVA = 16; // mm — cubierta nueva (100%), rango típico 15–17
const W = 46;          // diámetro de rueda (gauge)
const RING = 6;        // espesor del anillo gauge

// ── Anclaje de ruedas sobre la imagen cenital real ──
// Coordenadas en % del alto/ancho de la imagen renderizada.
const IMG_SRC = { SEMI: '/flota-assets/semi-top.png', DEFAULT: '/flota-assets/tractor-top.png' };
// X (% del ancho) por lado+posición
const X_POS: Record<string, number> = {
  'IZQ-EXT': 12, 'IZQ-INT': 28, 'IZQ-SIMPLE': 16,
  'DER-INT': 72, 'DER-EXT': 88, 'DER-SIMPLE': 84,
};
// Y (% del alto) por índice de eje según tipo de vehículo
function ejeYPct(idx0: number, totalEjes: number, esSemi: boolean, numSteering: number): number {
  if (esSemi) {
    // Semis: todos los ejes en el tren trasero (~66–88% de la imagen)
    const [a, b] = [66, 88];
    return totalEjes <= 1 ? 78 : a + (idx0 / (totalEjes - 1)) * (b - a);
  }
  // Tractor/camión: ejes de dirección adelante (~40%), de tracción atrás (~62–88%)
  if (idx0 < numSteering) return numSteering === 1 ? 40 : 36 + idx0 * 11;
  const driveIdx = idx0 - numSteering;
  const numDrive = Math.max(1, totalEjes - numSteering);
  const [a, b] = [62, 88];
  return numDrive <= 1 ? 72 : a + (driveIdx / (numDrive - 1)) * (b - a);
}

function usablePct(banda: number | null | undefined, orig: number | null | undefined) {
  if (banda == null) return null;
  const o = orig && orig > MIN_LEGAL ? orig : BANDA_NUEVA;
  return Math.max(0, Math.min(1, (banda - MIN_LEGAL) / (o - MIN_LEGAL)));
}
function bandaColor(pct: number | null) {
  if (pct == null) return '#d4d4d4';
  if (pct > 0.5) return '#22c55e';
  if (pct > 0.25) return '#f59e0b';
  return '#ef4444';
}
function bandaTxt(pct: number | null) {
  if (pct == null) return 'text-neutral-400';
  if (pct > 0.5) return 'text-green-600';
  if (pct > 0.25) return 'text-amber-600';
  return 'text-red-600';
}
const posLabel = (eje: number, lado: string, pos: string) =>
  pos === 'AUXILIO' ? 'Auxilio' : `Eje ${eje} · ${lado === 'IZQ' ? 'Izq' : 'Der'} · ${pos === 'SIMPLE' ? 'Simple' : pos === 'EXT' ? 'Ext' : 'Int'}`;

// ── Gauge radial de una rueda ──
function Rueda({ p, size = W, ghost = false, proyBanda }: { p: Posicion | null; size?: number; ghost?: boolean; proyBanda?: number | null }) {
  const n = p?.neumatico;
  const banda = ghost ? (proyBanda ?? null) : (n?.profBanda ?? null);
  const pct = usablePct(banda, n?.profBandaOriginal);
  const r = (size - RING) / 2;
  const circ = 2 * Math.PI * r;
  const color = bandaColor(pct);
  const critico = banda != null && banda <= 2.5;
  return (
    <div className={`relative rounded-full transition-transform ${ghost ? 'opacity-60' : ''}`} style={{ width: size, height: size, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
      <svg width={size} height={size} className="block">
        {/* pista */}
        <circle cx={size / 2} cy={size / 2} r={r} fill={n ? '#ffffff' : '#f5f5f5'} stroke={n ? '#e5e5e5' : '#e5e5e5'} strokeWidth={RING} strokeDasharray={n ? undefined : '3 4'} />
        {/* gauge de banda */}
        {n && pct != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={RING} strokeLinecap="round"
            strokeDasharray={`${Math.max(2, pct * circ)} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
        {/* aro interno */}
        <circle cx={size / 2} cy={size / 2} r={r - RING - 1.5} fill="none" stroke="#f0f0f0" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {n ? (
          <>
            <span className="text-[9px] font-bold text-neutral-700 truncate max-w-[52px]">{n.codigo}</span>
            <span className={`text-[11px] font-extrabold ${bandaTxt(pct)}`}>{banda != null ? `${banda.toFixed(1)}` : '—'}</span>
            <span className="text-[7px] text-neutral-400">mm</span>
          </>
        ) : (
          <span className="text-[8px] text-neutral-300">vacía</span>
        )}
      </div>
      {critico && !ghost && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"><AlertTriangle className="h-2.5 w-2.5" /></span>
      )}
    </div>
  );
}

export default function NeumaticosTwin({ vehiculoId, odometro, tipo, cantEjes, configEjes }: { vehiculoId: string; odometro: number | null; tipo?: string; cantEjes?: number | null; configEjes?: string | null }) {
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [libres, setLibres] = useState<Libre[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Posicion | null>(null);
  const [detalle, setDetalle] = useState<{ mediciones: any[]; rotaciones: any[] } | null>(null);
  const [proyKm, setProyKm] = useState(0);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [montar, setMontar] = useState<{ abierto: boolean; eje: number; lado: 'IZQ' | 'DER'; posicion: string }>({ abierto: false, eje: 1, lado: 'IZQ', posicion: 'SIMPLE' });
  const [accion, setAccion] = useState<{ tipo: 'medir' | 'presion' | null; banda: string; presion: string }>({ tipo: null, banda: '', presion: '' });
  const [toast, setToast] = useState<string | null>(null);
  // Control de presión (ronda de toda la unidad)
  const [control, setControl] = useState<{ abierto: boolean; observador: string; notas: string; mediciones: Record<string, string> }>({ abierto: false, observador: '', notas: '', mediciones: {} });
  const [ultimoControl, setUltimoControl] = useState<{ fecha: string; cubiertasRevisadas: number; cubiertasInfladas: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, n, c] = await Promise.all([
        apiFetch<{ posiciones: Posicion[] }>(`/flota/vehiculos/${vehiculoId}/diagrama`),
        apiFetch<{ neumaticos: any[] }>('/flota/neumaticos'),
        apiFetch<{ controles: any[] }>(`/flota/vehiculos/${vehiculoId}/controles-presion`).catch(() => ({ controles: [] })),
      ]);
      setPosiciones(d.posiciones || []);
      setLibres((n.neumaticos || []).filter((x: any) => x.status === 'DISPONIBLE'));
      setUltimoControl(c.controles?.[0] ?? null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehiculoId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  // ── Layout sobre la imagen real ──
  const esSemi = (tipo || '').toUpperCase() === 'SEMI';
  const numSteering = esSemi ? 0 : ((configEjes || '').trim().startsWith('8') ? 2 : 1);
  const ejesMontados = useMemo(() => [...new Set(posiciones.filter(p => p.posicion !== 'AUXILIO').map(p => p.eje))], [posiciones]);
  const maxMontado = ejesMontados.length ? Math.max(...ejesMontados) : 0;
  // cantEjes del vehículo manda; si no está seteado, default 2 (delantero+trasero). Nunca menos que los ejes con cubiertas montadas.
  const totalEjes = Math.max(cantEjes ?? 2, maxMontado);
  const ejes = useMemo(() => Array.from({ length: totalEjes }, (_, i) => i + 1), [totalEjes]);
  const auxilios = posiciones.filter(p => p.posicion === 'AUXILIO');
  const posDe = (eje: number, lado: string, pos: string) => posiciones.find(p => p.eje === eje && p.lado === lado && p.posicion === pos);
  // Dual si hay EXT/INT montadas; si el eje está vacío, doble por defecto en tracción/semi
  const esDual = (eje: number) => {
    if (posiciones.some(p => p.eje === eje && (p.posicion === 'EXT' || p.posicion === 'INT'))) return true;
    if (posiciones.some(p => p.eje === eje && p.posicion === 'SIMPLE')) return false;
    return esSemi ? true : eje > numSteering;
  };

  // ── Tasas de desgaste por neumático (para proyección) ──
  const [tasas, setTasas] = useState<Record<string, number | null>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string, number | null> = {};
      for (const p of posiciones) {
        const n = p.neumatico; if (!n) continue;
        try {
          const r = await apiFetch<{ mediciones: any[] }>(`/flota/neumaticos/${n.id}/mediciones`);
          const pts = (r.mediciones || []).filter((m: any) => m.kmAlMedir != null).sort((a: any, b: any) => a.kmAlMedir - b.kmAlMedir);
          if (pts.length >= 2) {
            const a = pts[0], b = pts[pts.length - 1];
            const dKm = b.kmAlMedir - a.kmAlMedir;
            out[n.id] = dKm > 0 ? (a.profBanda - b.profBanda) / dKm : null;
          } else if ((n.kmAcumulados || 0) > 1000 && (n.profBandaOriginal ?? BANDA_NUEVA) > (n.profBanda ?? 0)) {
            out[n.id] = ((n.profBandaOriginal ?? BANDA_NUEVA) - (n.profBanda ?? 0)) / (n.kmAcumulados || 1);
          } else out[n.id] = null;
        } catch { out[n.id] = null; }
      }
      setTasas(out);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posiciones]);

  const proyBandaDe = (n: Posicion['neumatico']) => {
    if (!n || n.profBanda == null || proyKm <= 0) return n?.profBanda ?? null;
    const tasa = tasas[n.id];
    if (tasa == null) return n.profBanda; // sin tasa: no proyectar (no inventar)
    return Math.max(0, n.profBanda - tasa * proyKm);
  };

  // ── Drag & drop ──
  const onDragStart = (e: React.DragEvent, p: Posicion) => {
    if (!p.neumatico) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ neumaticoId: p.neumatico.id, eje: p.eje, lado: p.lado, posicion: p.posicion }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const slotKey = (eje: number, lado: string, pos: string) => `${eje}-${lado}-${pos}`;
  const onDrop = async (e: React.DragEvent, eje: number, lado: 'IZQ' | 'DER', posicion: string) => {
    e.preventDefault(); setDragOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!d?.neumaticoId) return;
      if (d.eje === eje && d.lado === lado && d.posicion === posicion) return;
      const target = posDe(eje, lado, posicion);
      setBusy(true); setError(null);
      if (target?.neumatico) {
        // swap atómico
        await apiFetch('/flota/neumaticos/intercambiar', { method: 'POST', json: { neumaticoIdA: d.neumaticoId, neumaticoIdB: target.neumatico.id, kmAlRotar: odometro ?? undefined, notas: 'Intercambio visual' } });
        flash(`Intercambiadas ${posLabel(d.eje, d.lado, d.posicion)} ⇄ ${posLabel(eje, lado, posicion)}`);
      } else {
        await apiFetch(`/flota/neumaticos/${d.neumaticoId}/rotar`, { method: 'POST', json: { ejeDestino: eje, ladoDestino: lado, posDestino: posicion === 'AUXILIO' ? 'SIMPLE' : posicion, kmAlRotar: odometro ?? undefined, notas: 'Rotación visual' } });
        flash(`Rotada a ${posLabel(eje, lado, posicion)}`);
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo mover el neumático');
    } finally { setBusy(false); }
  };

  // ── Detalle ──
  const abrirDetalle = async (p: Posicion) => {
    setSel(p); setDetalle(null); setAccion({ tipo: null, banda: '', presion: '' });
    if (!p.neumatico) return;
    try {
      const [m, r] = await Promise.all([
        apiFetch<{ mediciones: any[] }>(`/flota/neumaticos/${p.neumatico.id}/mediciones`),
        apiFetch<{ rotaciones: any[] }>(`/flota/neumaticos/${p.neumatico.id}/rotaciones`),
      ]);
      setDetalle({ mediciones: m.mediciones || [], rotaciones: r.rotaciones || [] });
    } catch { setDetalle({ mediciones: [], rotaciones: [] }); }
  };

  const desmontar = async (p: Posicion) => {
    if (!p.neumatico) return;
    setBusy(true);
    try {
      await apiFetch(`/flota/neumaticos/${p.neumatico.id}/desmontar`, { method: 'POST', json: { kmAlDesmontar: odometro ?? undefined } });
      setSel(null); flash('Desmontada'); await load();
    } catch (e: any) { setError(e?.message || 'No se pudo desmontar'); } finally { setBusy(false); }
  };
  const montarNeumatico = async (neumaticoId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/flota/neumaticos/${neumaticoId}/montar`, { method: 'POST', json: { vehiculoId, eje: montar.eje, lado: montar.lado, posicion: montar.posicion, kmAlMontar: odometro ?? undefined } });
      setMontar({ ...montar, abierto: false }); flash('Montada'); await load();
    } catch (e: any) { setError(e?.message || 'No se pudo montar'); } finally { setBusy(false); }
  };
  const guardarAccion = async () => {
    const p = sel; if (!p?.neumatico) return;
    setBusy(true);
    try {
      if (accion.tipo === 'medir' && accion.banda) {
        await apiFetch(`/flota/neumaticos/${p.neumatico.id}/medicion`, { method: 'POST', json: { profBanda: Number(accion.banda), kmAlMedir: odometro ?? undefined, presion: accion.presion ? Number(accion.presion) : undefined, vehiculoId, eje: p.eje, lado: p.lado, posicion: p.posicion } });
        flash('Medición registrada');
      } else if (accion.tipo === 'presion' && accion.presion) {
        await apiFetch(`/flota/neumaticos/${p.neumatico.id}/presion`, { method: 'POST', json: { vehiculoId, eje: p.eje, lado: p.lado, posicion: p.posicion, presionMedida: Number(accion.presion) } });
        flash('Presión registrada');
      }
      setAccion({ tipo: null, banda: '', presion: '' });
      await load(); await abrirDetalle(p);
    } catch (e: any) { setError(e?.message || 'No se pudo guardar'); } finally { setBusy(false); }
  };

  // ── Control de presión (ronda de toda la unidad) ──
  const montadas = posiciones.filter(p => p.neumatico);
  const accionAuto = (psi: number, rec: number | null | undefined) => {
    if (rec == null) return 'VERIFICADA';
    if (psi < rec * 0.9) return 'INFLADA';   // estaba baja → se infló
    if (psi > rec * 1.15) return 'AJUSTADA'; // estaba alta → se corrigió
    return 'VERIFICADA';
  };
  const guardarControl = async () => {
    const items = montadas
      .map(p => {
        const psi = Number(control.mediciones[p.id]);
        if (!psi || psi <= 0) return null;
        return { neumaticoId: p.neumatico!.id, eje: p.eje, lado: p.lado, posicion: p.posicion, presionMedida: psi, accion: accionAuto(psi, p.neumatico!.presionRecomendada) };
      })
      .filter(Boolean);
    if (items.length === 0) { setError('Ingresá la presión medida de al menos una cubierta'); return; }
    setBusy(true); setError(null);
    try {
      await apiFetch(`/flota/vehiculos/${vehiculoId}/control-presion`, { method: 'POST', json: { observador: control.observador || undefined, kmAlControlar: odometro ?? undefined, notas: control.notas || undefined, items } });
      const infl = items.filter(i => i!.accion !== 'VERIFICADA').length;
      setControl({ abierto: false, observador: '', notas: '', mediciones: {} });
      flash(`Control registrado: ${items.length} revisadas${infl ? `, ${infl} infladas/ajustadas` : ''}`);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo registrar el control'); } finally { setBusy(false); }
  };
  const diasDesdeControl = ultimoControl ? Math.floor((Date.now() - new Date(ultimoControl.fecha).getTime()) / 86400000) : null;

  // ── Agregar / quitar eje (persiste cantEjes en el vehículo) ──
  const cambiarEjes = async (delta: number) => {
    const nuevo = totalEjes + delta;
    if (nuevo < 1 || nuevo > 10) return;
    if (delta < 0) {
      const ocupado = posiciones.some(p => p.eje === totalEjes && p.posicion !== 'AUXILIO' && p.neumatico);
      if (ocupado) { setError(`El eje ${totalEjes} tiene cubiertas montadas — desmontalas primero`); return; }
    }
    setBusy(true); setError(null);
    try {
      await apiFetch(`/flota/vehiculos/${vehiculoId}`, { method: 'PATCH', json: { cantEjes: nuevo } });
      flash(`${nuevo} ejes`);
      await load();
    } catch (e: any) { setError(e?.message || 'No se pudo actualizar los ejes'); } finally { setBusy(false); }
  };

  // ── Slot (rueda o hueco drop-target) ──
  const slot = (eje: number, lado: 'IZQ' | 'DER', posicion: 'SIMPLE' | 'EXT' | 'INT' | 'AUXILIO') => {
    const p = posDe(eje, lado, posicion);
    const key = slotKey(eje, lado, posicion);
    const isTarget = dragOver === key;
    return (
      <div
        key={key}
        onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
        onDragLeave={() => setDragOver(k => (k === key ? null : k))}
        onDrop={(e) => onDrop(e, eje, lado, posicion)}
        onClick={() => p?.neumatico ? abrirDetalle(p) : setMontar({ abierto: true, eje, lado, posicion })}
        className={`relative rounded-full transition-all ${isTarget ? 'ring-4 ring-violet-400 scale-110' : ''} ${p?.neumatico ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'cursor-pointer hover:ring-2 hover:ring-blue-300'}`}
        title={p?.neumatico ? `${p.neumatico.codigo} · ${posLabel(eje, lado, posicion)} — arrastrá para rotar` : `Montar en ${posLabel(eje, lado, posicion)}`}
      >
        <div draggable={!!p?.neumatico} onDragStart={(e) => p && onDragStart(e, p)}>
          <Rueda p={p} proyBanda={proyKm > 0 ? proyBandaDe(p?.neumatico ?? null) : undefined} ghost={proyKm > 0} />
        </div>
        {p?.ultimaPresion && <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-neutral-400 whitespace-nowrap">{p.ultimaPresion.presionMedida} psi</p>}
      </div>
    );
  };

  const imgSrc = esSemi ? IMG_SRC.SEMI : IMG_SRC.DEFAULT;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><CircleDot className="h-3.5 w-3.5 text-violet-600" /> Gemelo de neumáticos {esSemi && <span className="text-[9px] font-normal text-neutral-400">(semi)</span>}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <span>Proyectar</span>
            <input type="range" min={0} max={100000} step={5000} value={proyKm} onChange={e => setProyKm(Number(e.target.value))} className="w-24 accent-violet-600" />
            <span className="font-mono w-14 text-violet-700 font-semibold">{proyKm > 0 ? `+${(proyKm / 1000).toLocaleString('es-AR')}k` : 'hoy'}</span>
          </div>
          {/* Stepper de ejes: suma/quita una fila de ruedas */}
          <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 px-1 py-0.5" title="Cantidad de ejes del vehículo">
            <span className="text-[9px] font-medium text-neutral-400 px-0.5">Ejes</span>
            <button disabled={busy || totalEjes <= 1} onClick={() => cambiarEjes(-1)} className="h-4 w-4 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 text-xs leading-none">−</button>
            <span className="w-4 text-center text-[11px] font-bold text-neutral-700">{totalEjes}</span>
            <button disabled={busy || totalEjes >= 10} onClick={() => cambiarEjes(1)} className="h-4 w-4 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 text-xs leading-none">+</button>
          </div>
          <button onClick={() => setControl({ abierto: true, observador: '', notas: '', mediciones: {} })} disabled={montadas.length === 0} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:underline disabled:opacity-40" title={montadas.length === 0 ? 'No hay cubiertas montadas' : 'Registrar control de presión de toda la unidad'}><Gauge className="h-3 w-3" /> Control PSI</button>
          <button onClick={() => setMontar({ abierto: true, eje: 1, lado: 'IZQ', posicion: 'SIMPLE' })} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"><ArrowDownToLine className="h-3 w-3" /> Montar</button>
        </div>
      </div>

      {/* Badge último control de presión */}
      {!loading && (
        <div className="px-3 pb-1">
          {ultimoControl ? (
            <p className={`text-[10px] ${diasDesdeControl != null && diasDesdeControl > 15 ? 'text-amber-600 font-medium' : 'text-neutral-400'}`}>
              Último control de presión: <b>{new Date(ultimoControl.fecha).toLocaleDateString('es-AR')}</b> (hace {diasDesdeControl}d) · {ultimoControl.cubiertasRevisadas} revisadas{ultimoControl.cubiertasInfladas ? `, ${ultimoControl.cubiertasInfladas} infladas` : ''}
              {diasDesdeControl != null && diasDesdeControl > 15 && ' — recomendado cada ~15 días'}
            </p>
          ) : (
            <p className="text-[10px] text-neutral-400">Sin controles de presión registrados — usá "Control PSI" para dejar constancia.</p>
          )}
        </div>
      )}

      {error && <p className="mx-3 mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}
      {toast && <p className="mx-3 mt-2 rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-xs text-green-700">{toast}</p>}

      <div className="p-4 flex gap-4">
        {/* ── Esquema cenital sobre la imagen real ── */}
        <div className="shrink-0">
          <div className="relative mx-auto" style={{ width: 240 }}>
            {loading ? (
              <p className="text-xs text-neutral-400 py-10 text-center">Cargando…</p>
            ) : (
              <>
                <img src={imgSrc} alt={esSemi ? 'Semirremolque visto desde arriba' : 'Vehículo visto desde arriba'} className="block w-full h-auto select-none" draggable={false} />
                {/* Ruedas-gauge posicionadas sobre los ejes de la imagen */}
                {ejes.map((eje) => {
                  const y = ejeYPct(eje - 1, totalEjes, esSemi, numSteering);
                  const dual = esDual(eje);
                  const slotsDef: { lado: 'IZQ' | 'DER'; pos: 'SIMPLE' | 'EXT' | 'INT' }[] = dual
                    ? [{ lado: 'IZQ', pos: 'EXT' }, { lado: 'IZQ', pos: 'INT' }, { lado: 'DER', pos: 'INT' }, { lado: 'DER', pos: 'EXT' }]
                    : [{ lado: 'IZQ', pos: 'SIMPLE' }, { lado: 'DER', pos: 'SIMPLE' }];
                  return slotsDef.map(s => (
                    <div key={`${eje}-${s.lado}-${s.pos}`} className="absolute" style={{ left: `${X_POS[`${s.lado}-${s.pos}`]}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}>
                      {slot(eje, s.lado, s.pos)}
                    </div>
                  ));
                })}
                {/* etiqueta de eje */}
                {ejes.map((eje) => (
                  <span key={`lbl-${eje}`} className="absolute left-1/2 -translate-x-1/2 text-[8px] font-bold text-neutral-500/70 uppercase pointer-events-none" style={{ top: `${ejeYPct(eje - 1, totalEjes, esSemi, numSteering)}%`, transform: 'translate(-50%,-50%)' }}>E{eje}</span>
                ))}
              </>
            )}
          </div>
          {/* Auxilio debajo de la imagen */}
          {!loading && (
            <div className="relative flex items-center justify-center gap-2 pt-3 mt-2 border-t border-dashed border-neutral-200">
              <span className="text-[9px] font-bold text-neutral-400 uppercase">Auxilio</span>
              {auxilios.length > 0 ? auxilios.map(p => slot(p.eje, p.lado, 'AUXILIO')) : slot(0, 'IZQ', 'AUXILIO')}
            </div>
          )}
        </div>

        {/* ── Drawer de detalle ── */}
        <div className="w-[300px] shrink-0 border-l border-neutral-100 pl-4">
          {!sel ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 py-10">
              <Move className="h-6 w-6 mb-2 text-neutral-300" />
              <p className="text-xs">Arrastrá una rueda para rotarla o intercambiarla.<br />Tocá una rueda para ver su detalle.</p>
              <p className="text-[10px] mt-3 text-neutral-300">El anillo muestra la banda restante (verde → rojo).<br />El slider proyecta el desgaste a futuro.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-900">{sel.neumatico?.codigo || 'Posición vacía'}</p>
                  <p className="text-[10px] text-neutral-500">{posLabel(sel.eje, sel.lado, sel.posicion)}</p>
                </div>
                <button onClick={() => setSel(null)}><X className="h-4 w-4 text-neutral-400" /></button>
              </div>

              {sel.neumatico && (
                <>
                  <div className="flex items-center gap-3">
                    <Rueda p={sel} size={72} />
                    <div className="text-[11px] space-y-0.5">
                      <p className="text-neutral-600">{[sel.neumatico.marca, sel.neumatico.medida].filter(Boolean).join(' · ') || '—'}</p>
                      <p className="text-neutral-500">Banda: <b className={bandaTxt(usablePct(sel.neumatico.profBanda, sel.neumatico.profBandaOriginal))}>{sel.neumatico.profBanda ?? '—'} mm</b> / {sel.neumatico.profBandaOriginal ?? BANDA_NUEVA} mm</p>
                      <p className="text-neutral-500">Km acum.: <b>{Math.round(sel.neumatico.kmAcumulados || 0).toLocaleString('es-AR')}</b></p>
                      {sel.neumatico.recapsCount > 0 && <p className="text-neutral-500">Recaps: {sel.neumatico.recapsCount}</p>}
                      {sel.ultimaPresion && <p className="text-neutral-500">Presión: <b>{sel.ultimaPresion.presionMedida} psi</b>{sel.neumatico.presionRecomendada ? ` / ${sel.neumatico.presionRecomendada}` : ''}</p>}
                    </div>
                  </div>

                  {/* Curva de desgaste */}
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-600 uppercase mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Curva de desgaste</p>
                    {!detalle ? <p className="text-[10px] text-neutral-400">Cargando…</p>
                      : detalle.mediciones.length === 0 ? <p className="text-[10px] text-neutral-400">Sin mediciones — registrá una para construir la curva.</p>
                      : (() => {
                          const pts = detalle.mediciones.filter((m: any) => m.profBanda != null).sort((a: any, b: any) => (a.kmAlMedir ?? 0) - (b.kmAlMedir ?? 0));
                          const w = 260, h = 90, pad = 18;
                          const maxB = Math.max(BANDA_NUEVA, ...pts.map((m: any) => m.profBanda));
                          const xs = pts.map((m: any, i: number) => pad + (pts.length === 1 ? (w - 2 * pad) / 2 : (i / (pts.length - 1)) * (w - 2 * pad)));
                          const ys = pts.map((m: any) => h - pad - ((m.profBanda - 0) / maxB) * (h - 2 * pad));
                          const line = xs.map((x: number, i: number) => `${x},${ys[i]}`).join(' ');
                          const tasa = tasas[sel.neumatico!.id];
                          const kmRest = tasa && tasa > 0 && sel.neumatico!.profBanda != null ? Math.round((sel.neumatico!.profBanda - MIN_LEGAL) / tasa) : null;
                          return (
                            <>
                              <svg width={w} height={h} className="rounded-md bg-neutral-50 border border-neutral-100">
                                <line x1={pad} y1={h - pad - (MIN_LEGAL / maxB) * (h - 2 * pad)} x2={w - pad} y2={h - pad - (MIN_LEGAL / maxB) * (h - 2 * pad)} stroke="#fca5a5" strokeDasharray="3 3" strokeWidth="1" />
                                <text x={w - pad} y={h - pad - (MIN_LEGAL / maxB) * (h - 2 * pad) - 3} fontSize="8" fill="#ef4444" textAnchor="end">{MIN_LEGAL}mm mín</text>
                                {pts.length > 1 && <polyline points={line} fill="none" stroke="#8b5cf6" strokeWidth="2" />}
                                {pts.map((m: any, i: number) => <circle key={i} cx={xs[i]} cy={ys[i]} r="3" fill="#8b5cf6" />)}
                              </svg>
                              <div className="mt-1 text-[10px] text-neutral-500">
                                {tasa != null ? <>Tasa medida: <b>{(tasa * 1000).toFixed(2)} mm/1000km</b>{kmRest != null && <> · restan ~<b>{kmRest.toLocaleString('es-AR')} km</b></>}</> : 'Sin tasa (1 sola medición o sin km)'}
                              </div>
                            </>
                          );
                        })()}
                  </div>

                  {/* Rotaciones recientes */}
                  {detalle && detalle.rotaciones.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-neutral-600 uppercase mb-1">Rotaciones ({detalle.rotaciones.length})</p>
                      <ul className="space-y-1 max-h-24 overflow-y-auto">
                        {detalle.rotaciones.slice(0, 5).map((r: any) => (
                          <li key={r.id} className="text-[10px] text-neutral-500 rounded border border-neutral-100 px-2 py-1">
                            {posLabel(r.ejeOrigen, r.ladoOrigen, r.posOrigen)} → {posLabel(r.ejeDestino, r.ladoDestino, r.posDestino)} · {new Date(r.fecha).toLocaleDateString('es-AR')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={() => setAccion({ tipo: 'medir', banda: '', presion: '' })} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"><Ruler className="h-3 w-3" /> Medir</button>
                    <button onClick={() => setAccion({ tipo: 'presion', banda: '', presion: '' })} className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100"><Gauge className="h-3 w-3" /> Presión</button>
                    <button disabled={busy} onClick={() => desmontar(sel)} className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100"><ArrowUpFromLine className="h-3 w-3" /> Desmontar</button>
                  </div>

                  {/* Form acción inline */}
                  {accion.tipo && (
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5 space-y-2">
                      {accion.tipo === 'medir' && (
                        <div>
                          <label className="block text-[10px] font-medium text-neutral-600">Banda (mm)</label>
                          <input type="number" step="0.1" min={0} max={30} value={accion.banda} onChange={e => setAccion({ ...accion, banda: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" placeholder="ej: 5.2" />
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-600">Presión (psi){accion.tipo === 'medir' ? ' · opcional' : ''}</label>
                        <input type="number" step="0.5" min={0} value={accion.presion} onChange={e => setAccion({ ...accion, presion: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" placeholder={sel.neumatico.presionRecomendada ? `Rec: ${sel.neumatico.presionRecomendada}` : ''} />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setAccion({ tipo: null, banda: '', presion: '' })} className="rounded border border-neutral-300 px-2 py-1 text-[10px] text-neutral-600">Cancelar</button>
                        <button disabled={busy || (accion.tipo === 'medir' ? !accion.banda : !accion.presion)} onClick={guardarAccion} className="rounded bg-violet-600 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50">Guardar</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="px-4 pb-3 text-[9px] text-neutral-400">Vista cenital · Izq/Der según sentido de marcha · EXT/INT = rueda doble · Arrastrá una rueda sobre otra para intercambiar, o sobre un hueco para moverla.</p>

      {/* Modal montar */}
      {montar.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold">Montar en {posLabel(montar.eje, montar.lado, montar.posicion)}</h3>
              <button onClick={() => setMontar({ ...montar, abierto: false })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <select id="montar-sel" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" defaultValue="">
                <option value="">Seleccionar neumático…</option>
                {libres.map(n => <option key={n.id} value={n.id}>{n.codigo} · {n.marca || ''} {n.medida || ''}</option>)}
              </select>
              {libres.length === 0 && <p className="text-[11px] text-amber-600">Sin neumáticos disponibles. <Link href="/flota-360/neumaticos" className="text-blue-600 underline">Crear →</Link></p>}
              {posDe(montar.eje, montar.lado, montar.posicion)?.neumatico && <p className="text-[11px] text-amber-600">Posición ocupada — al montar se desmonta la actual.</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setMontar({ ...montar, abierto: false })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy} onClick={() => { const el = document.getElementById('montar-sel') as HTMLSelectElement; if (el?.value) montarNeumatico(el.value); }} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Montando…' : 'Montar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal control de presión (ronda de toda la unidad) */}
      {control.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Gauge className="h-4 w-4 text-emerald-600" /> Control de presión</h3>
              <button onClick={() => setControl({ ...control, abierto: false })}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-[11px] text-neutral-500">Ingresá el PSI medido en cada cubierta. Si está por debajo de la recomendada se marca <b>inflada</b> automáticamente.</p>
              <div className="space-y-1.5">
                {montadas.map(p => {
                  const rec = p.neumatico!.presionRecomendada;
                  const psi = Number(control.mediciones[p.id]) || 0;
                  const acc = psi > 0 ? accionAuto(psi, rec) : null;
                  return (
                    <div key={p.id} className="flex items-center gap-2 rounded-md border border-neutral-200 px-2.5 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-neutral-800 truncate">{p.neumatico!.codigo} <span className="font-normal text-neutral-400">· {posLabel(p.eje, p.lado, p.posicion)}</span></p>
                        <p className="text-[9px] text-neutral-400">{rec != null ? `Rec: ${rec} psi` : 'Sin presión recomendada'}</p>
                      </div>
                      <input type="number" min={0} step="0.5" value={control.mediciones[p.id] || ''} onChange={e => setControl({ ...control, mediciones: { ...control.mediciones, [p.id]: e.target.value } })} placeholder="PSI" className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs text-right" />
                      {acc && <span className={`text-[9px] font-bold w-16 text-right ${acc === 'VERIFICADA' ? 'text-green-600' : 'text-amber-600'}`}>{acc === 'VERIFICADA' ? 'OK' : acc === 'INFLADA' ? 'Inflada' : 'Ajustada'}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Observador</label>
                  <input value={control.observador} onChange={e => setControl({ ...control, observador: e.target.value })} placeholder="Quién controla" className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Notas</label>
                  <input value={control.notas} onChange={e => setControl({ ...control, notas: e.target.value })} placeholder="Opcional" className="w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setControl({ ...control, abierto: false })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={busy} onClick={guardarControl} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Guardando…' : 'Registrar control'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
