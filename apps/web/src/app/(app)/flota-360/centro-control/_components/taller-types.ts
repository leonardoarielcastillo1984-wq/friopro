// ============================================================
// Taller Inteligente — tipos del snapshot agregado
// Fuente: GET /fleet-ops/taller-resumen (solo lectura)
// ============================================================

export type EtapaIndisponibilidad =
  | 'PENDIENTE_INGRESO' | 'PENDIENTE_DIAGNOSTICO' | 'ESPERANDO_PRESUPUESTO'
  | 'ESPERANDO_AUTORIZACION' | 'ESPERANDO_REPUESTO' | 'ESPERANDO_PAGO_REPUESTO'
  | 'ESPERANDO_TURNO_MANO_OBRA' | 'REPARACION_EN_CURSO' | 'PENDIENTE_VERIFICACION'
  | 'PENDIENTE_HABILITACION' | 'OTRO' | string;

export interface TallerUnidad {
  id: string;
  dominio: string;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  estadoOperativo: string;
  estadoComentario: string | null;
  currentOdometer: number | null;
  episodioId: string | null;
  diasInmovilizada: number | null;
  etapa: EtapaIndisponibilidad | null;
  tallerTipo: 'INTERNO' | 'EXTERNO' | null;
  fechaIngresoTaller: string | null;
  ot: { id: string; code: string; title: string; status: string; priority: string; type: string } | null;
}

export interface TallerOT {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'ON_HOLD' | string;
  vehiculoId: string | null;
  vehiculo: string | null;
  vehiculoTipo: string | null;
  assetNombre: string | null;
  tecnico: { id: string; name: string; specialization: string | null } | null;
  taller: { id: string; nombre: string; tipo: string } | null;
  ejecutorTipo: 'INTERNO' | 'EXTERNO' | string;
  scheduledDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedDuration: number | null;
  actualDuration: number | null;
  fechaIngresoTaller: string | null;
  fechaEntregaEstimada: string | null;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  costoExterno: number;
  tareas: { total: number; completadas: number };
  repuestos: { id: string; repuesto: string | null; cantidad: number; stock: number; falta: boolean }[];
}

export interface TallerEpisodio {
  id: string;
  vehiculoId: string;
  dominio: string | null;
  tipo: string | null;
  estadoOperativo: string | null;
  inicioAt: string;
  motivo: string | null;
  origen: string;
  dias: number;
  etapa: EtapaIndisponibilidad | null;
  etapaInicioAt: string | null;
  tallerTipo: 'INTERNO' | 'EXTERNO' | null;
  tallerNombre: string | null;
  fechaIngresoTaller: string | null;
  fechaDevolucionEstimada: string | null;
  responsableSeguimientoNombre: string | null;
  workOrderIds: string[];
}

export interface TallerMecanico {
  id: string;
  code: string;
  name: string;
  specialization: string | null;
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFF' | string;
  dailyCapacityHours: number;
  otsActivas: number;
  otsPendientes: number;
  ordenes: { id: string; code: string; status: string; title: string; priority: string; scheduledDate: string | null }[];
}

export interface TallerRepuestoPend {
  workOrderId: string;
  otCode: string;
  vehiculoId: string | null;
  vehiculo: string | null;
  sparePartId: string;
  repuesto: string;
  codigo: string | null;
  requerido: number;
  stock: number;
  falta: boolean;
  costoUnit: number;
}

export interface TallerKpis {
  unidadesEnTaller: number;
  unidadesInmovilizadas: number;
  otsAbiertas: number;
  otsEnEjecucion: number;
  otsPendientes: number;
  otsEnEspera: number;
  otsUrgentes: number;
  mecanicosTotal: number;
  mecanicosOcupados: number;
  mecanicosDisponibles: number;
  repuestosFaltantes: number;
  repuestosComprometidos: number;
  costoMes: number;
  mttrHoras: number | null;
  trabajosFinalizados90d: number;
  cumplimientoPreventivoPct: number | null;
  preventivoVsCorrectivo: { preventivo: number; correctivo: number };
}

export interface TallerSnapshot {
  kpis: TallerKpis;
  unidadesTaller: TallerUnidad[];
  ots: TallerOT[];
  episodios: TallerEpisodio[];
  mecanicos: TallerMecanico[];
  repuestosPendientes: TallerRepuestoPend[];
  costoPorUnidad: { vehiculoId: string; dominio: string | null; total: number }[];
  porTipoCosto: Record<string, number>;
}

// ── Derivados de presentación ──

export type BayEstado = 'disponible' | 'ejecucion' | 'espera_repuestos' | 'bloqueado' | 'finalizado' | 'fuera_servicio';

export const BAY_COLOR: Record<BayEstado, string> = {
  disponible: '#22c55e',
  ejecucion: '#38bdf8',
  espera_repuestos: '#eab308',
  bloqueado: '#ef4444',
  finalizado: '#7dd3fc',
  fuera_servicio: '#64748b',
};

export const BAY_LABEL: Record<BayEstado, string> = {
  disponible: 'Disponible',
  ejecucion: 'Trabajo en ejecución',
  espera_repuestos: 'Esperando repuestos',
  bloqueado: 'Trabajo bloqueado',
  finalizado: 'Trabajo finalizado',
  fuera_servicio: 'Fuera de servicio',
};

export const ETAPA_LABEL: Record<string, string> = {
  PENDIENTE_INGRESO: 'Pendiente de ingreso',
  PENDIENTE_DIAGNOSTICO: 'Pendiente diagnóstico',
  ESPERANDO_PRESUPUESTO: 'Esperando presupuesto',
  ESPERANDO_AUTORIZACION: 'Esperando autorización',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  ESPERANDO_PAGO_REPUESTO: 'Esperando pago repuesto',
  ESPERANDO_TURNO_MANO_OBRA: 'Esperando mano de obra',
  REPARACION_EN_CURSO: 'Reparación en curso',
  PENDIENTE_VERIFICACION: 'Pendiente verificación',
  PENDIENTE_HABILITACION: 'Pendiente habilitación',
  OTRO: 'Otro',
};

// Prioridad para el modo "Atención requerida" (reglas documentadas)
export interface TallerAlerta {
  sev: 'crit' | 'warn' | 'info';
  motivo: string;
  unidadId?: string;
  dominio?: string;
  otId?: string;
  otCode?: string;
}

export function buildTallerAlertas(s: TallerSnapshot): TallerAlerta[] {
  const out: TallerAlerta[] = [];
  for (const ep of s.episodios) {
    if (ep.dias >= 15) out.push({ sev: 'crit', motivo: `${ep.dias} días inmovilizada`, unidadId: ep.vehiculoId, dominio: ep.dominio ?? undefined });
    else if (ep.dias >= 7) out.push({ sev: 'warn', motivo: `${ep.dias} días inmovilizada`, unidadId: ep.vehiculoId, dominio: ep.dominio ?? undefined });
    if (ep.etapa === 'ESPERANDO_REPUESTO' || ep.etapa === 'ESPERANDO_PAGO_REPUESTO')
      out.push({ sev: 'warn', motivo: ETAPA_LABEL[ep.etapa] ?? ep.etapa, unidadId: ep.vehiculoId, dominio: ep.dominio ?? undefined });
  }
  for (const ot of s.ots) {
    if (['HIGH', 'CRITICAL'].includes(ot.priority))
      out.push({ sev: ot.priority === 'CRITICAL' ? 'crit' : 'warn', motivo: `OT ${ot.priority === 'CRITICAL' ? 'crítica' : 'alta'}`, unidadId: ot.vehiculoId ?? undefined, dominio: ot.vehiculo ?? undefined, otId: ot.id, otCode: ot.code });
    if (ot.status === 'ON_HOLD')
      out.push({ sev: 'warn', motivo: 'OT en espera', unidadId: ot.vehiculoId ?? undefined, dominio: ot.vehiculo ?? undefined, otId: ot.id, otCode: ot.code });
    if (!ot.tecnico && ot.ejecutorTipo === 'INTERNO')
      out.push({ sev: 'info', motivo: 'OT sin mecánico asignado', unidadId: ot.vehiculoId ?? undefined, dominio: ot.vehiculo ?? undefined, otId: ot.id, otCode: ot.code });
    if (ot.repuestos.some((r) => r.falta))
      out.push({ sev: 'crit', motivo: 'Repuestos faltantes', unidadId: ot.vehiculoId ?? undefined, dominio: ot.vehiculo ?? undefined, otId: ot.id, otCode: ot.code });
  }
  const rank = { crit: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

// Estado visual de una bahía según la unidad/OT que la ocupa
export function estadoBahia(u: TallerUnidad | null | undefined, ot: TallerOT | null | undefined): BayEstado {
  if (!u) return 'disponible';
  if (ot?.status === 'ON_HOLD') return 'bloqueado';
  if (u.etapa === 'ESPERANDO_REPUESTO' || u.etapa === 'ESPERANDO_PAGO_REPUESTO' || ot?.repuestos.some((r) => r.falta)) return 'espera_repuestos';
  if (u.etapa === 'PENDIENTE_VERIFICACION' || u.etapa === 'PENDIENTE_HABILITACION') return 'finalizado';
  if (ot?.status === 'IN_PROGRESS' || u.estadoOperativo === 'EN_REPARACION' || u.etapa === 'REPARACION_EN_CURSO') return 'ejecucion';
  if (u.estadoOperativo === 'EN_TALLER' || u.episodioId) return 'fuera_servicio';
  return 'disponible';
}
