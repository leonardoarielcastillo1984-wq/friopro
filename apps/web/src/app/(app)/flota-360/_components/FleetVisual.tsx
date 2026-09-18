'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, CalendarClock, Wrench, ArrowUpRight } from 'lucide-react';

export function VehicleArt({ semi = false, className = '' }: { semi?: boolean; className?: string }) {
  return <img src={`/flota-assets/${semi ? 'semi' : 'tractor'}-top.png`} alt={semi ? 'Ilustración de semirremolque, vista superior' : 'Ilustración de tractor, vista superior'} className={`fleet-vehicle-art ${className}`} />;
}

type ComponentState = { label?: string; salud?: number | null; sinDatos?: boolean; kmRestantes?: number; vencidos?: number; porVencer?: number; l100km?: number | null };
export function DigitalTwin({ vehicle, components, health }: { vehicle: { id: string; dominio: string; tipo: string }; components: Record<string, ComponentState>; health?: number | null }) {
  const semi = vehicle.tipo === 'SEMI';
  const keys = semi ? ['acople', 'documentacion', 'suspension', 'frenos', 'ejes', 'neumaticos'] : ['motor', 'frenos', 'combustible', 'documentacion', 'neumaticos'];
  const [selected, setSelected] = useState(keys[0]);
  const current = components[selected];
  const color = (c?: ComponentState) => !c || c.sinDatos || c.salud == null ? '#94a3b8' : c.salud >= 80 ? '#16a34a' : c.salud >= 60 ? '#e9a008' : '#e34848';
  const labels: Record<string, string> = { motor: 'Motor / aceite', frenos: 'Frenos', combustible: 'Combustible', documentacion: 'Documentación', neumaticos: 'Neumáticos', suspension: 'Suspensión', ejes: 'Ejes', acople: 'Acople' };
  return <section className="fleet-panel fleet-twin">
    <header className="fleet-panel-heading"><h2>Gemelo digital</h2><span className="fleet-caption">{semi ? 'Semirremolque' : 'Tractor / camión'}</span></header>
    <div className="fleet-twin-stage">
      <VehicleArt semi={semi} />
      {keys.map((key, i) => <button key={key} aria-pressed={selected === key} onClick={() => setSelected(key)} className={`fleet-hotspot ${i % 2 ? 'right' : 'left'} ${selected === key ? 'selected' : ''}`} style={{ top: `${17 + Math.floor(i / 2) * 29}%`, '--system-color': color(components[key]) } as React.CSSProperties}>
        <span className="fleet-system-dot" /><strong>{labels[key]}</strong><span>{components[key]?.sinDatos || components[key]?.salud == null ? 'Sin datos' : `${Math.round(components[key].salud!)} / 100`}</span>
      </button>)}
    </div>
    <div className="fleet-component-detail" aria-live="polite">
      <div className="flex items-center justify-between gap-2"><strong>{labels[selected]}</strong><span style={{ color: color(current) }}>{current?.sinDatos || current?.salud == null ? 'Sin medición' : `Índice ${Math.round(current.salud)} / 100`}</span></div>
      <p className="mt-1 text-xs text-slate-500">{current?.kmRestantes != null ? `${current.kmRestantes.toLocaleString('es-AR')} km de referencia restantes` : current?.vencidos != null ? `${current.vencidos} documentos vencidos · ${current.porVencer || 0} próximos` : current?.l100km != null ? `${current.l100km} L / 100 km` : 'Consultá el historial y los controles registrados para este sistema.'}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><Link href={`/flota-360/planes?vehiculoId=${vehicle.id}`}><CalendarClock size={13} /> Ver frecuencias</Link><Link href={`/flota-360/ordenes?nueva=1&vehiculoId=${vehicle.id}&titulo=${encodeURIComponent('Revisión de ' + labels[selected])}`}><Wrench size={13} /> Crear OT</Link></div>
    </div>
    <p className="px-4 pb-3 text-[10px] text-slate-400">Ilustración orientativa. Índices calculados por el sistema; no representan una medición física de desgaste.</p>
  </section>;
}

export function CoupledVisual({ tractor, semi, coupled = true }: { tractor: {id: string; dominio: string}; semi: {id: string; dominio: string}; coupled?: boolean }) {
  return <section className="fleet-panel fleet-coupled">
    <header className="fleet-panel-heading"><h2>Tractor + semi</h2><span className="fleet-caption">{coupled ? 'Conjunto acoplado' : 'Conjunto desacoplado'}</span></header>
    <div className={`fleet-coupled-stage ${coupled ? '' : 'uncoupled'}`}>
      <Link href={`/flota-360/vehiculos/${tractor.id}`} className="fleet-coupled-tractor"><VehicleArt /><span>{tractor.dominio} <ArrowUpRight size={13} /></span></Link>
      <Link href={`/flota-360/vehiculos/${semi.id}`} className="fleet-coupled-semi"><VehicleArt semi /><span>{semi.dominio} <ArrowUpRight size={13} /></span></Link>
    </div>
    <p className="text-center text-xs text-slate-500 pb-4">Seleccioná el tractor o el semi para consultar su gemelo digital.</p>
  </section>;
}
