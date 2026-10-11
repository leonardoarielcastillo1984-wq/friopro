// ============================================================
// Centro de Control Operativo — tipos compartidos
// ============================================================

export type VisualStatus =
  | 'disponible'            // estacionado, apto
  | 'en_viaje'            // EN_SERVICIO real (jornada abierta)
  | 'en_taller'           // episodio con ingreso efectivo a taller
  | 'fuera_servicio'      // episodio abierto sin ingreso a taller / restringida
  | 'mantenimiento_proximo' // disponible pero con plan vencido/por vencer
  | 'inactiva';           // INACTIVO (no BAJA — las bajas no se dibujan)

export interface CCUnit {
  id: string;
  dominio: string;
  tipo: string;             // TRACTOR | SEMI | CAMION | ...
  status: VisualStatus;
  statusLabel: string;      // etiqueta compuesta del backend
  conductor?: string | null;
  currentOdometer?: number | null;
  alerts: string[];         // advertencias + restricciones + alertas de servicio
  source: 'real' | 'demo';
  // Posición lógica en el mapa iso (la asigna el engine/escena)
  x: number;
  y: number;
}

export type EventLevel = 'critica' | 'advertencia' | 'info' | 'exito';

export interface CCEvent {
  id: string;
  at: string;               // ISO
  unidad?: string;          // dominio
  unidadId?: string;
  kind: string;             // checklist | falla | ot | ingreso_taller | viaje | servicio | estadia
  text: string;
  level: EventLevel;
  source: 'real' | 'demo';
}

export interface Kpis {
  total: number;
  operativos: number;
  pctDisponible: number | null;
  enViaje: number;
  enTaller: number;
  fueraServicio: number;
  mantProximos: number;     // planes vencidos/por vencer
  checklistsHoy?: number | null;
  incidencias: number;      // alertasEstadia + restricciones + advertencias
  costoMes: number | null;
}

export type Mode = 'real' | 'demo';
export type DemoSpeed = 1 | 2 | 4;

// ── Coordenadas lógicas del escenario (grilla 32 × 20) ──
export const GRID_W = 32;
export const GRID_H = 20;
export const TILE = 26; // px base de media loseta

// Zonas del patio operativo (coordenadas de grilla)
export interface Zone {
  key: string;
  label: string;
  sub: string;
  x: number; y: number; w: number; d: number; h: number;
  face: string; side: string;
}

export const ZONES: Zone[] = [
  { key: 'deposito',   label: 'DEPÓSITO GENERAL',   sub: 'Recepción y despacho',      x: 4,  y: 1,  w: 7, d: 4, h: 34, face: '#33415e', side: '#232c42' },
  { key: 'planta1',    label: 'PLANTA RUEDAS',      sub: 'Armado y control',          x: 12, y: 0,  w: 6, d: 4, h: 30, face: '#2e3d5c', side: '#20293f' },
  { key: 'planta2',    label: 'PLANTA PARAGOLPES',  sub: 'Producción y expedición',   x: 20, y: 0,  w: 7, d: 4, h: 36, face: '#35446a', side: '#243050' },
  { key: 'taller',     label: 'TALLER',             sub: 'Mantenimiento',             x: 9,  y: 8,  w: 6, d: 4, h: 26, face: '#3d3350', side: '#2a2340' },
  { key: 'admin',      label: 'ADMINISTRACIÓN',     sub: 'Operaciones y planificación', x: 17, y: 12, w: 6, d: 4, h: 30, face: '#2f4a56', side: '#1f3540' },
  { key: 'calidad',    label: 'CALIDAD',            sub: 'Auditorías y controles',    x: 24, y: 7,  w: 5, d: 3, h: 22, face: '#355038', side: '#243a28' },
];

// Estacionamiento: slots de la grilla (2 filas)
export const PARK_SLOTS: { x: number; y: number }[] = [
  { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 },
  { x: 1, y: 12 }, { x: 2, y: 12 }, { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 },
  { x: 1, y: 15 }, { x: 2, y: 15 }, { x: 3, y: 15 }, { x: 4, y: 15 }, { x: 5, y: 15 },
  { x: 1, y: 18 }, { x: 2, y: 18 }, { x: 3, y: 18 }, { x: 4, y: 18 }, { x: 5, y: 18 },
];

// Bahías del taller (frente al edificio 'taller')
export const SHOP_BAYS: { x: number; y: number }[] = [
  { x: 9.5, y: 12.5 }, { x: 11, y: 12.5 }, { x: 12.5, y: 12.5 }, { x: 14, y: 12.5 },
];

// Detenidas / fuera de servicio (sector acordonado)
export const HOLD_SLOTS: { x: number; y: number }[] = [
  { x: 24, y: 13 }, { x: 25.5, y: 13 }, { x: 27, y: 13 },
  { x: 24, y: 15.5 }, { x: 25.5, y: 15.5 }, { x: 27, y: 15.5 },
];

// Circuito interno que recorren las unidades "en viaje / en servicio"
// (anillo por el perímetro de la grilla)
export const ROUTE_LOOP: { x: number; y: number }[] = [
  { x: 7, y: 6.5 }, { x: 14, y: 6.5 }, { x: 21, y: 6.5 }, { x: 28, y: 6.5 },
  { x: 29.5, y: 9 }, { x: 29.5, y: 12 }, { x: 29.5, y: 15 }, { x: 28, y: 17.5 },
  { x: 21, y: 17.5 }, { x: 14, y: 17.5 }, { x: 7, y: 17.5 }, { x: 6, y: 14 },
  { x: 6, y: 10 }, { x: 6.5, y: 7.5 },
];

// Muelles del depósito (camiones en carga)
export const DOCK_SLOTS: { x: number; y: number }[] = [
  { x: 5, y: 5.5 }, { x: 7, y: 5.5 }, { x: 9, y: 5.5 },
];
