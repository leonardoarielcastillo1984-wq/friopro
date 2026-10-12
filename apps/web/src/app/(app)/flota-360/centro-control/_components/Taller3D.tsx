'use client';

// ============================================================
// Wrapper React del interior 3D del Taller Inteligente.
// Monta TallerWorld, traduce el snapshot a bahías y unidades.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, RotateCw, Maximize2 } from 'lucide-react';
import type { TallerWorld, TallerBayState } from './world/TallerWorld';
import { TALLER_BAYS } from './world/TallerWorld';
import { estadoBahia, BAY_COLOR, BAY_LABEL, type BayEstado, type TallerSnapshot } from './taller-types';

interface Props {
  snapshot: TallerSnapshot | null;
  selectedUnitId: string | null;
  attentionIds: Set<string> | null;
  onSelectUnit: (id: string) => void;
  onSelectBay: (key: string) => void;
}

export default function Taller3D({ snapshot, selectedUnitId, attentionIds, onSelectUnit, onSelectBay }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<TallerWorld | null>(null);
  const cbRef = useRef({ onSelectUnit, onSelectBay });
  cbRef.current = { onSelectUnit, onSelectBay };
  const [zoom, setZoom] = useState(1);
  const [counts, setCounts] = useState<Partial<Record<BayEstado, number>>>({});

  useEffect(() => {
    let alive = true;
    let w: TallerWorld | null = null;
    (async () => {
      const mod = await import('./world/TallerWorld');
      if (!alive || !hostRef.current) return;
      const host = hostRef.current;
      w = new mod.TallerWorld(host, {
        onSelectUnit: (id) => cbRef.current.onSelectUnit(id),
        onSelectBay: (k) => { w?.focusBay(k); cbRef.current.onSelectBay(k); },
        // Ancho del panel operativo superpuesto a la derecha (se descuenta del encuadre)
        rightInset: () => {
          const ov = host.closest('.cc-area-map')?.querySelector('.cc-taller-overlay') as HTMLElement | null;
          if (!ov) return 0;
          const hr = host.getBoundingClientRect(), orc = ov.getBoundingClientRect();
          return Math.max(0, hr.right - orc.left + 8);
        },
        onZoomChange: (z) => setZoom(z),
      });
      worldRef.current = w;
      await w.init();
      w.resetView();
      applySnapshot();
    })();
    return () => { alive = false; w?.dispose(); worldRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySnapshot = () => {
    const w = worldRef.current;
    if (!w) return;
    if (!snapshot) return;
    // Bahías: asignación por orden de ingreso (las unidades con ingreso
    // efectivo al taller ocupan bahías; el resto espera afuera).
    const ocupadas = snapshot.unidadesTaller
      .filter((u) => u.fechaIngresoTaller || ['EN_TALLER', 'EN_REPARACION'].includes(u.estadoOperativo))
      .sort((a, b) => (a.fechaIngresoTaller ?? '').localeCompare(b.fechaIngresoTaller ?? ''));
    const states = new Map<string, TallerBayState>();
    TALLER_BAYS.forEach((b, i) => {
      const u = ocupadas[i] ?? null;
      const ot = u?.ot ? snapshot.ots.find((o) => o.id === u.ot!.id) ?? null : null;
      states.set(b.key, {
        estado: estadoBahia(u, ot),
        unidad: u ? { id: u.id, dominio: u.dominio } : null,
        otCode: ot?.code ?? null,
      });
    });
    w.setBayStates(states);
    const c: Partial<Record<BayEstado, number>> = {};
    for (const s of states.values()) c[s.estado] = (c[s.estado] ?? 0) + 1;
    setCounts(c);
    w.setUnits(ocupadas.map((u) => ({ id: u.id, dominio: u.dominio, tipo: u.tipo, estadoOperativo: u.estadoOperativo }))
      .concat(snapshot.unidadesTaller.filter((u) => !ocupadas.includes(u)).map((u) => ({ id: u.id, dominio: u.dominio, tipo: u.tipo, estadoOperativo: u.estadoOperativo }))));
    // Mecánicos junto a la bahía de su OT activa
    const mechSpots = snapshot.ots
      .filter((o) => o.status === 'IN_PROGRESS' && o.tecnico && o.vehiculoId)
      .map((o) => {
        const bay = [...states.entries()].find(([, s]) => s.unidad?.id === o.vehiculoId)?.[0];
        return bay ? { bay, name: o.tecnico!.name } : null;
      })
      .filter((x): x is { bay: string; name: string } => !!x);
    w.setMechanics(mechSpots);
  };

  useEffect(() => { applySnapshot(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [snapshot]);
  useEffect(() => {
    worldRef.current?.setSelected(selectedUnitId);
    if (selectedUnitId) worldRef.current?.focusUnit(selectedUnitId);
  }, [selectedUnitId]);
  const attKey = attentionIds ? [...attentionIds].sort().join(',') : '';
  useEffect(() => { worldRef.current?.setAttention(attentionIds); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [attKey]);

  const w = () => worldRef.current;
  return (
    <div className="ccw-wrap">
      <div ref={hostRef} className="ccw-host" />
      <div className="ccw-ctrls" role="toolbar" aria-label="Cámara del taller">
        <button onClick={() => w()?.zoomBy(1.35)} title="Acercar" aria-label="Acercar"><Plus size={15} /></button>
        <span className="ccw-zoom">{Math.round(zoom * 100)}%</span>
        <button onClick={() => w()?.zoomBy(1 / 1.35)} title="Alejar" aria-label="Alejar"><Minus size={15} /></button>
        <i />
        <button onClick={() => w()?.rotateBy(0.35)} title="Girar a la izquierda" aria-label="Girar a la izquierda"><RotateCcw size={14} /></button>
        <button onClick={() => w()?.rotateBy(-0.35)} title="Girar a la derecha" aria-label="Girar a la derecha"><RotateCw size={14} /></button>
        <button onClick={() => w()?.resetView()} title="Ver todo el taller" aria-label="Ver todo el taller"><Maximize2 size={14} /></button>
      </div>
      <div className="ccw-legend" aria-label="Estados de bahía">
        {(Object.keys(BAY_LABEL) as BayEstado[]).map((k) => (
          <span key={k} className={counts[k] ? '' : 'off'}>
            <i style={{ background: BAY_COLOR[k] }} />{BAY_LABEL[k]}<b>{counts[k] ?? 0}</b>
          </span>
        ))}
        <small>Rueda o pellizco: zoom · Arrastrar: mover · Clic derecho/Shift: girar · Doble clic: acercar</small>
      </div>
    </div>
  );
}
