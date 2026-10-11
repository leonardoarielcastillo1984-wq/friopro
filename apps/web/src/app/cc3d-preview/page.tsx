'use client';

// ============================================================
// Harness de verificación visual del Centro de Control 3D.
// Ruta pública (sin auth) que monta Scene3D con unidades demo.
//   /cc3d-preview          → escenario del tenant / genérico
//   /cc3d-preview?yard=dada     → fuerza escenario DADA
//   /cc3d-preview?yard=generic  → fuerza escenario genérico
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import Scene3D from '../(app)/flota-360/centro-control/_components/Scene3D';
import { createDemoState } from '../(app)/flota-360/centro-control/_components/DemoEngine';
import { scenarioForTenant } from '../(app)/flota-360/centro-control/_components/world/scenario';
import type { CCUnit, VisualStatus } from '../(app)/flota-360/centro-control/_components/types';
import '../(app)/flota-360/centro-control/centro.css';

const LABEL: Record<VisualStatus, string> = {
  disponible: 'Disponible · Sin servicio',
  en_viaje: 'En servicio',
  en_taller: 'En taller · Reparación en curso',
  fuera_servicio: 'No disponible · Restringida',
  mantenimiento_proximo: 'Disponible · Servicio próximo',
  inactiva: 'Inactiva',
};

// Enriquece la demo para poblar todos los grupos del predio DADA:
// tractores+semis en la playa, pickups en el lote de livianos,
// taller, fuera de servicio e inactivas en el lote este.
function dadaDemoUnits(): CCUnit[] {
  const base = createDemoState().units;
  const extras: CCUnit[] = [];
  const mk = (id: string, dominio: string, tipo: string, status: VisualStatus): CCUnit => ({
    id, dominio, tipo, status, statusLabel: LABEL[status],
    conductor: 'J. Pérez', currentOdometer: 90000, alerts: [], source: 'demo', x: 0, y: 0,
  });
  for (let i = 0; i < 26; i++) extras.push(mk(`dada-t${i}`, `AE ${300 + i} QZ`, 'TRACTOR', 'disponible'));
  for (let i = 0; i < 10; i++) extras.push(mk(`dada-c${i}`, `AE ${400 + i} KJ`, 'CAMION', 'disponible'));
  for (let i = 0; i < 14; i++) extras.push(mk(`dada-s${i}`, `AC ${700 + i} AB`, 'SEMI', 'disponible'));
  for (let i = 0; i < 16; i++) extras.push(mk(`dada-l${i}`, `AF ${100 + i} CD`, 'PICKUP', i < 12 ? 'disponible' : 'en_viaje'));
  for (let i = 0; i < 3; i++) extras.push(mk(`dada-w${i}`, `AD ${500 + i} RT`, 'TRACTOR', 'en_taller'));
  for (let i = 0; i < 4; i++) extras.push(mk(`dada-h${i}`, `AC ${600 + i} LM`, 'TRACTOR', 'fuera_servicio'));
  for (let i = 0; i < 16; i++) extras.push(mk(`dada-i${i}`, `AB ${200 + i} VF`, i % 3 ? 'TRACTOR' : 'SEMI', 'inactiva'));
  for (let i = 0; i < 5; i++) extras.push(mk(`dada-r${i}`, `AF ${800 + i} GH`, 'TRACTOR', 'en_viaje'));
  return [...base.slice(0, 8), ...extras];
}

export default function CC3DPreview() {
  // Solo en cliente: el escenario se resuelve con ?yard= (window.location)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scenario = useMemo(() => (mounted ? scenarioForTenant(null) : null), [mounted]);
  const units = useMemo(
    () => (scenario?.key === 'dada' ? dadaDemoUnits() : createDemoState().units),
    [scenario],
  );
  if (!scenario) return <div style={{ position: 'fixed', inset: 0, background: '#0b1220' }} />;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1220' }}>
      <Scene3D
        units={units}
        selectedId={null}
        onSelect={() => {}}
        mode="demo"
        scenario={scenario}
      />
    </div>
  );
}
