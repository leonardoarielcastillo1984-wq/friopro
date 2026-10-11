'use client';

// ============================================================
// Wrapper React del interior 3D del Taller Inteligente.
// Monta TallerWorld, traduce el snapshot a bahías y unidades.
// ============================================================
import { useEffect, useRef } from 'react';
import type { TallerWorld, TallerBayState } from './world/TallerWorld';
import { TALLER_BAYS } from './world/TallerWorld';
import { estadoBahia, type TallerSnapshot } from './taller-types';

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

  useEffect(() => {
    let alive = true;
    let w: TallerWorld | null = null;
    (async () => {
      const mod = await import('./world/TallerWorld');
      if (!alive || !hostRef.current) return;
      w = new mod.TallerWorld(hostRef.current, {
        onSelectUnit: (id) => cbRef.current.onSelectUnit(id),
        onSelectBay: (k) => { w?.focusBay(k); cbRef.current.onSelectBay(k); },
      });
      worldRef.current = w;
      await w.init();
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
  useEffect(() => { worldRef.current?.setSelected(selectedUnitId); }, [selectedUnitId]);
  useEffect(() => { worldRef.current?.setAttention(attentionIds); }, [attentionIds]);

  return <div ref={hostRef} className="ccw-host" />;
}
