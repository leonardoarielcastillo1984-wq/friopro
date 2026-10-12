// ============================================================
// Taller Inteligente — adapter de datos.
// REAL: GET /fleet-ops/taller-resumen (agregado de solo lectura).
// DEMO: snapshot sintético marcado como simulado, nunca escribe.
// ============================================================
import { apiFetch } from '@/lib/api';
import type { CCUnit } from './types';
import type { TallerSnapshot, TallerUnidad, TallerOT, TallerEpisodio, TallerMecanico } from './taller-types';

export async function fetchTallerResumen(): Promise<TallerSnapshot | null> {
  try {
    const s = await apiFetch<TallerSnapshot>('/fleet-ops/taller-resumen');
    // apiFetch devuelve {} ante cualquier error HTTP — validar el shape
    // real del snapshot antes de exponerlo a la UI.
    if (!s || typeof s !== 'object' || !s.kpis || !Array.isArray(s.ots)) return null;
    return s;
  } catch {
    return null;
  }
}

// ── Snapshot DEMO (claramente simulado) ──
export function demoTallerSnapshot(units: CCUnit[]): TallerSnapshot {
  const enTaller = units.filter((u) => u.status === 'en_taller' || u.status === 'fuera_servicio').slice(0, 6);
  const mecanicos: TallerMecanico[] = [
    { id: 'm1', code: 'MEC-01', name: 'R. González', specialization: 'Motor', availabilityStatus: 'BUSY', dailyCapacityHours: 8, otsActivas: 1, otsPendientes: 1, ordenes: [] },
    { id: 'm2', code: 'MEC-02', name: 'M. Sosa', specialization: 'Frenos', availabilityStatus: 'AVAILABLE', dailyCapacityHours: 8, otsActivas: 0, otsPendientes: 2, ordenes: [] },
    { id: 'm3', code: 'MEC-03', name: 'J. Pereyra', specialization: 'Eléctrico', availabilityStatus: 'OFF', dailyCapacityHours: 8, otsActivas: 0, otsPendientes: 0, ordenes: [] },
  ];
  const dias = [2, 6, 12, 21, 1, 34];
  const etapas = ['REPARACION_EN_CURSO', 'ESPERANDO_REPUESTO', 'PENDIENTE_DIAGNOSTICO', 'REPARACION_EN_CURSO', 'PENDIENTE_INGRESO', 'ESPERANDO_AUTORIZACION'];
  const now = Date.now();
  const unidadesTaller: TallerUnidad[] = enTaller.map((u, i) => ({
    id: u.id, dominio: u.dominio, tipo: u.tipo ?? null, marca: null, modelo: null,
    estadoOperativo: i % 3 === 0 ? 'EN_REPARACION' : 'EN_TALLER',
    estadoComentario: null, currentOdometer: u.currentOdometer ?? null,
    episodioId: `ep-${u.id}`, diasInmovilizada: dias[i % dias.length],
    etapa: etapas[i % etapas.length],
    tallerTipo: 'INTERNO', fechaIngresoTaller: new Date(now - dias[i % dias.length] * 86400e3).toISOString(),
    ot: { id: `ot-${i}`, code: `OT-10${i}`, title: ['Cambio de pastillas de freno', 'Service 20.000 km', 'Falla eléctrica luces', 'Embrague', 'Diagnóstico general', 'Reparación diferencial'][i % 6], status: i % 3 === 0 ? 'IN_PROGRESS' : i % 3 === 1 ? 'ON_HOLD' : 'PENDING', priority: i === 5 ? 'CRITICAL' : i % 2 ? 'HIGH' : 'MEDIUM', type: i % 2 ? 'PREVENTIVE' : 'CORRECTIVE' },
  }));
  const ots: TallerOT[] = unidadesTaller.map((u, i) => ({
    id: u.ot!.id, code: u.ot!.code, title: u.ot!.title,
    description: null, type: u.ot!.type, priority: u.ot!.priority, status: u.ot!.status,
    vehiculoId: u.id, vehiculo: u.dominio, vehiculoTipo: u.tipo,
    assetNombre: u.dominio, tecnico: i < 2 ? { id: mecanicos[i].id, name: mecanicos[i].name, specialization: mecanicos[i].specialization } : null,
    taller: null, ejecutorTipo: 'INTERNO',
    scheduledDate: null, startedAt: u.ot!.status !== 'PENDING' ? u.fechaIngresoTaller : null,
    completedAt: null, estimatedDuration: 8, actualDuration: null,
    fechaIngresoTaller: u.fechaIngresoTaller, fechaEntregaEstimada: null,
    laborCost: 0, partsCost: 0, totalCost: 0, costoExterno: 0,
    tareas: { total: 3, completadas: i % 3 },
    repuestos: i === 1 ? [{ id: 'r1', repuesto: 'Kit pastillas de freno', cantidad: 1, stock: 0, falta: true }] : [],
  }));
  const episodios: TallerEpisodio[] = unidadesTaller.map((u, i) => ({
    id: u.episodioId!, vehiculoId: u.id, dominio: u.dominio, tipo: u.tipo,
    estadoOperativo: u.estadoOperativo, inicioAt: u.fechaIngresoTaller!,
    motivo: u.ot!.title, origen: 'OT', dias: u.diasInmovilizada!,
    etapa: u.etapa, etapaInicioAt: u.fechaIngresoTaller,
    tallerTipo: 'INTERNO', tallerNombre: null,
    fechaIngresoTaller: u.fechaIngresoTaller, fechaDevolucionEstimada: null,
    responsableSeguimientoNombre: null, workOrderIds: [u.ot!.id],
  }));
  return {
    kpis: {
      unidadesEnTaller: unidadesTaller.length, unidadesInmovilizadas: unidadesTaller.length,
      otsAbiertas: ots.length, otsEnEjecucion: ots.filter((o) => o.status === 'IN_PROGRESS').length,
      otsPendientes: ots.filter((o) => o.status === 'PENDING').length,
      otsEnEspera: ots.filter((o) => o.status === 'ON_HOLD').length,
      otsUrgentes: ots.filter((o) => ['HIGH', 'CRITICAL'].includes(o.priority)).length,
      mecanicosTotal: mecanicos.length, mecanicosOcupados: 1, mecanicosDisponibles: 1,
      repuestosFaltantes: 1, repuestosComprometidos: 1,
      costoMes: 0, mttrHoras: 14.5, trabajosFinalizados90d: 12,
      cumplimientoPreventivoPct: 83, preventivoVsCorrectivo: { preventivo: 7, correctivo: 5 },
    },
    unidadesTaller, ots, episodios, mecanicos,
    repuestosPendientes: [{
      workOrderId: 'ot-1', otCode: 'OT-101', vehiculoId: unidadesTaller[1]?.id ?? null,
      vehiculo: unidadesTaller[1]?.dominio ?? null, sparePartId: 'r1',
      repuesto: 'Kit pastillas de freno', codigo: 'FR-2210', requerido: 1, stock: 0, falta: true, costoUnit: 0,
    }],
    costoPorUnidad: [], porTipoCosto: {},
  };
}
