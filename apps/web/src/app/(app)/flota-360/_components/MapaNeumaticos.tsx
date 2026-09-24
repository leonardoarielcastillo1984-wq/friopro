'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Truck, AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Mapa de flota de neumáticos — salud de cubiertas por vehículo.
// Cada tarjeta muestra un mini-esquema cenital con el color de la
// banda de cada posición, el peor neumático y la salud promedio.
// ═══════════════════════════════════════════════════════════════

type Pos = { id: string; eje: number; lado: string; posicion: string; neumatico: { id: string; codigo: string; profBanda: number | null; profBandaOriginal: number | null; kmAcumulados: number | null; condicion: string; recapsCount: number } | null };
type Veh = { id: string; dominio: string; tipo: string; marca: string | null; modelo: string | null; currentOdometer: number | null; posicionesNeumatico: Pos[] };

const MIN_LEGAL = 1.6;
function pct(banda: number | null | undefined, orig: number | null | undefined) {
  if (banda == null) return null;
  const o = orig && orig > MIN_LEGAL ? orig : 8;
  return Math.max(0, Math.min(1, (banda - MIN_LEGAL) / (o - MIN_LEGAL)));
}
function color(p: number | null) { return p == null ? '#e5e5e5' : p > 0.5 ? '#22c55e' : p > 0.25 ? '#f59e0b' : '#ef4444'; }

function MiniRueda({ p }: { p: Pos | undefined }) {
  const n = p?.neumatico;
  const pc = pct(n?.profBanda, n?.profBandaOriginal);
  const critico = n?.profBanda != null && n.profBanda <= 2.5;
  return (
    <div title={n ? `${n.codigo} · ${n.profBanda ?? '—'}mm` : 'vacía'} className="relative rounded-full border-2 flex items-center justify-center" style={{ width: 22, height: 22, borderColor: n ? color(pc) : '#e5e5e5', background: n ? '#fff' : '#fafafa', borderStyle: n ? 'solid' : 'dashed' }}>
      {n && <span className="text-[6px] font-bold" style={{ color: color(pc) }}>{n.profBanda != null ? n.profBanda.toFixed(0) : '·'}</span>}
      {critico && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />}
    </div>
  );
}

export default function MapaNeumaticos() {
  const [vehiculos, setVehiculos] = useState<Veh[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch<{ vehiculos: Veh[] }>('/flota/neumaticos/mapa-flota');
        setVehiculos(r.vehiculos || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const cards = useMemo(() => vehiculos.map(v => {
    const pos = v.posicionesNeumatico || [];
    const montadas = pos.filter(p => p.neumatico);
    const conBanda = montadas.filter(p => p.neumatico!.profBanda != null);
    const avg = conBanda.length ? conBanda.reduce((s, p) => s + (pct(p.neumatico!.profBanda, p.neumatico!.profBandaOriginal) ?? 0), 0) / conBanda.length : null;
    const peor = conBanda.slice().sort((a, b) => (a.neumatico!.profBanda ?? 99) - (b.neumatico!.profBanda ?? 99))[0];
    const criticas = montadas.filter(p => p.neumatico!.profBanda != null && p.neumatico!.profBanda <= 2.5).length;
    const ejes = [...new Set(pos.filter(p => p.posicion !== 'AUXILIO').map(p => p.eje))].sort((a, b) => a - b);
    const posDe = (eje: number, lado: string, pp: string) => pos.find(x => x.eje === eje && x.lado === lado && x.posicion === pp);
    const esDual = (eje: number) => pos.some(x => x.eje === eje && (x.posicion === 'EXT' || x.posicion === 'INT'));
    return { v, montadas: montadas.length, avg, peor, criticas, ejes, posDe, esDual };
  }).filter(c => c.montadas > 0), [vehiculos]);

  if (loading) return <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-400">Cargando mapa de flota…</div>;
  if (cards.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-violet-600" /> Mapa de flota — salud de cubiertas</span>
        <span className="text-[10px] text-neutral-400">{cards.length} vehículo(s) con neumáticos montados</span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {cards.map(c => (
          <Link key={c.v.id} href={`/flota-360/vehiculos/${c.v.id}`} className="group rounded-lg border border-neutral-200 hover:border-violet-300 hover:shadow-md transition-all p-3 bg-gradient-to-b from-white to-neutral-50">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-neutral-900 group-hover:text-violet-700">{c.v.dominio}</p>
                <p className="text-[10px] text-neutral-500">{[c.v.marca, c.v.modelo].filter(Boolean).join(' ') || c.v.tipo}</p>
              </div>
              <div className="text-right">
                {c.avg != null && (
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: color(c.avg) + '22', color: color(c.avg) }}>
                    {Math.round(c.avg * 100)}%
                  </div>
                )}
                {c.criticas > 0 && <p className="text-[9px] text-red-600 font-semibold flex items-center gap-0.5 justify-end mt-0.5"><AlertTriangle className="h-2.5 w-2.5" />{c.criticas} crítica(s)</p>}
              </div>
            </div>
            {/* mini esquema cenital */}
            <div className="relative mx-auto my-1" style={{ width: 150 }}>
              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-14 rounded-t-xl rounded-b border border-neutral-300 bg-neutral-100" />
              <div className="relative space-y-1.5 py-1">
                {c.ejes.map(eje => (
                  <div key={eje} className="flex items-center justify-between px-0.5">
                    <div className="flex gap-0.5">{c.esDual(eje) ? <><MiniRueda p={c.posDe(eje, 'IZQ', 'EXT')} /><MiniRueda p={c.posDe(eje, 'IZQ', 'INT')} /></> : <MiniRueda p={c.posDe(eje, 'IZQ', 'SIMPLE')} />}</div>
                    <div className="flex gap-0.5">{c.esDual(eje) ? <><MiniRueda p={c.posDe(eje, 'DER', 'INT')} /><MiniRueda p={c.posDe(eje, 'DER', 'EXT')} /></> : <MiniRueda p={c.posDe(eje, 'DER', 'SIMPLE')} />}</div>
                  </div>
                ))}
              </div>
            </div>
            {c.peor?.neumatico && (
              <p className="text-[9px] text-neutral-500 mt-1.5 text-center">Peor: <b className="text-neutral-700">{c.peor.neumatico.codigo}</b> · {c.peor.neumatico.profBanda}mm · Eje {c.peor.eje} {c.peor.lado}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
