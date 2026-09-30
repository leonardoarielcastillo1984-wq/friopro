// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Estado de unidad: tests A–P
// Unitarios con prisma falso en memoria (sin DB): episodios, etapas,
// cierre con causas, impedimentos de servicio y etiqueta compuesta.
// ═══════════════════════════════════════════════════════════════
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirIndisponibilidad, cambiarEtapa, cerrarIndisponibilidadManual,
  evaluarYCerrarIndisponibilidad, impedimentosParaServicio,
  registrarIngresoTaller, registrarSalidaTaller, registrarUbicacion,
  componerEstado, episodioAbiertoDe, ETAPA_LABEL,
} from '../services/unidadEstadoService.js';

// ── Prisma falso en memoria ─────────────────────────────────────
// Soporta solo lo que usa unidadEstadoService: where por igualdad,
// { in }, { OR }, include de etapas (con orderBy) y de caso/vehiculo.
function prismaFalso(seed: Partial<Record<string, any[]>> = {}) {
  const db: Record<string, any[]> = {
    vehiculo: [], unidadIndisponibilidad: [], unidadIndisponibilidadEtapa: [],
    vehiculoEstadoEvento: [], maintenanceAsset: [], restriccionServicio: [],
    workOrder: [], defectoCaso: [], conjuntoOperativo: [],
    vehiculoUbicacionEvento: [], flotaJornada: [],
    ...seed,
  };
  let seq = 0;
  const nextId = () => `id-${++seq}`;

  const cumpleWhere = (row: any, where: any): boolean => {
    for (const [k, cond] of Object.entries(where ?? {})) {
      if (k === 'OR') {
        if (!(cond as any[]).some((w) => cumpleWhere(row, w))) return false;
      } else if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        const c = cond as any;
        if (c.in && !c.in.includes(row[k])) return false;
        if (c.not !== undefined && row[k] === c.not) return false;
      } else if (row[k] !== cond) return false;
    }
    return true;
  };

  const incluir = (tabla: string, row: any, include: any) => {
    if (!row || !include) return row;
    const out = { ...row };
    if (include.etapas) {
      out.etapas = db.unidadIndisponibilidadEtapa
        .filter((e: any) => e.indisponibilidadId === row.id)
        .sort((a: any, b: any) => +new Date(a.inicioAt) - +new Date(b.inicioAt));
    }
    if (include.caso) out.caso = db.defectoCaso.find((c: any) => c.id === row.casoId) ?? null;
    if (include.vehiculo) out.vehiculo = db.vehiculo.find((v: any) => v.id === row.vehiculoId) ?? null;
    return out;
  };

  // Defaults del schema que el runtime (DB) aplica y el fake debe simular
  const DEFAULTS: Record<string, any> = {
    unidadIndisponibilidad: { estado: 'ABIERTA', ambiguo: false, workOrderIds: [] },
    conjuntoOperativo: { estado: 'ACOPLADO' },
  };

  const modelo = (tabla: string) => ({
    findFirst: async ({ where, include, orderBy }: any = {}) => {
      let rows = db[tabla].filter((r) => cumpleWhere(r, where));
      if (orderBy) {
        const [campo, dir] = Array.isArray(orderBy) ? [orderBy[0]] : Object.entries(orderBy)[0] as any;
        const campoName = Array.isArray(orderBy) ? Object.keys(orderBy[0])[0] : campo;
        const direccion = Array.isArray(orderBy) ? orderBy[0][campoName] : dir;
        rows = rows.sort((a, b) => (direccion === 'desc' ? -1 : 1) * (+new Date(a[campoName]) - +new Date(b[campoName])));
      }
      return incluir(tabla, rows[0] ?? null, include);
    },
    findMany: async ({ where, include, orderBy }: any = {}) => {
      let rows = db[tabla].filter((r) => cumpleWhere(r, where));
      if (orderBy) {
        const [campo, dir] = Object.entries(orderBy)[0] as any;
        rows = rows.sort((a, b) => (dir === 'desc' ? -1 : 1) * (+new Date(a[campo]) - +new Date(b[campo])));
      }
      return rows.map((r) => incluir(tabla, r, include));
    },
    findUnique: async ({ where, include }: any = {}) =>
      incluir(tabla, db[tabla].find((r) => r.id === where.id) ?? null, include),
    create: async ({ data, include }: any = {}) => {
      const { etapas, ...resto } = data;
      const row = { id: nextId(), createdAt: new Date(), ...(DEFAULTS[tabla] ?? {}), ...resto };
      db[tabla].push(row);
      if (etapas?.create) {
        const et = Array.isArray(etapas.create) ? etapas.create : [etapas.create];
        for (const e of et) {
          db.unidadIndisponibilidadEtapa.push({ id: nextId(), indisponibilidadId: row.id, createdAt: new Date(), ...e });
        }
      }
      return incluir(tabla, row, include);
    },
    update: async ({ where, data, include }: any = {}) => {
      const row = db[tabla].find((r) => r.id === where.id);
      assert.ok(row, `${tabla} ${where.id} no existe en el prisma falso`);
      Object.assign(row, data);
      return incluir(tabla, row, include);
    },
    updateMany: async ({ where, data }: any = {}) => {
      const rows = db[tabla].filter((r) => cumpleWhere(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
    deleteMany: async ({ where }: any = {}) => {
      const n = db[tabla].length;
      db[tabla] = db[tabla].filter((r) => !cumpleWhere(r, where));
      return { count: n - db[tabla].length };
    },
    count: async ({ where }: any = {}) => db[tabla].filter((r) => cumpleWhere(r, where)).length,
  });

  const tx: any = {};
  for (const tabla of Object.keys(db)) tx[tabla] = modelo(tabla);
  return { tx, db };
}

const T = 't1';
const VEH = { id: 'v1', tenantId: T, dominio: 'AAA111', status: 'ACTIVO', estadoOperativo: 'OPERATIVO', maintenanceAssetId: 'a1' };
const base = (extraDb: any = {}) => prismaFalso({
  vehiculo: [{ ...VEH }],
  maintenanceAsset: [{ id: 'a1', tenantId: T, status: 'ACTIVE' }],
  ...extraDb,
});

// ═══ EPISODIOS ═══
describe('UnidadEstado — episodios', () => {
  it('A) abrirIndisponibilidad crea episodio + etapa y sincroniza derivados', async () => {
    const { tx, db } = base();
    const r: any = await abrirIndisponibilidad(tx, {
      tenantId: T, vehiculoId: 'v1', origen: 'MANUAL', etapa: 'REPARACION_EN_CURSO', motivo: 'rotura',
    });
    assert.ok(!r.error);
    assert.equal(db.unidadIndisponibilidad.length, 1);
    assert.equal(db.unidadIndisponibilidad[0].estado, 'ABIERTA');
    assert.equal(db.unidadIndisponibilidadEtapa.length, 1);
    assert.equal(db.unidadIndisponibilidadEtapa[0].etapa, 'REPARACION_EN_CURSO');
    // Derivados: estadoOperativo según etapa, status espejo EN_TALLER
    assert.equal(db.vehiculo[0].estadoOperativo, 'EN_REPARACION');
    assert.equal(db.vehiculo[0].status, 'EN_TALLER');
    assert.equal(db.maintenanceAsset[0].status, 'MAINTENANCE');
    // Evento legacy para compatibilidad
    assert.equal(db.vehiculoEstadoEvento.length, 1);
  });

  it('B) abrir sobre episodio abierto absorbe la OT sin reiniciar inicioAt', async () => {
    const t0 = new Date('2026-01-10T08:00:00Z');
    const { tx, db } = base({
      unidadIndisponibilidad: [{
        id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA',
        inicioAt: t0, origen: 'OT', workOrderIds: ['ot1'],
      }],
      unidadIndisponibilidadEtapa: [{ id: 'et1', tenantId: T, indisponibilidadId: 'ep1', etapa: 'REPARACION_EN_CURSO', inicioAt: t0, finAt: null }],
    });
    const r: any = await abrirIndisponibilidad(tx, {
      tenantId: T, vehiculoId: 'v1', origen: 'OT', etapa: 'REPARACION_EN_CURSO', workOrderId: 'ot2',
    });
    assert.ok(!r.error);
    assert.equal(db.unidadIndisponibilidad.length, 1, 'no duplica el episodio');
    assert.deepEqual(db.unidadIndisponibilidad[0].workOrderIds, ['ot1', 'ot2']);
    assert.equal(db.unidadIndisponibilidad[0].inicioAt, t0, 'inicioAt intacto');
  });

  it('C) cambiarEtapa cierra la vigente y abre la nueva sin tocar el episodio', async () => {
    const t0 = new Date('2026-01-10T08:00:00Z');
    const { tx, db } = base({
      unidadIndisponibilidad: [{ id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA', inicioAt: t0, workOrderIds: [] }],
      unidadIndisponibilidadEtapa: [{ id: 'et1', tenantId: T, indisponibilidadId: 'ep1', etapa: 'ESPERANDO_REPUESTO', inicioAt: t0, finAt: null }],
    });
    const r: any = await cambiarEtapa(tx, {
      tenantId: T, indisponibilidadId: 'ep1', etapa: 'REPARACION_EN_CURSO', comentario: 'llegó el repuesto',
    });
    assert.ok(!r.error);
    assert.equal(db.unidadIndisponibilidadEtapa.length, 2);
    assert.ok(db.unidadIndisponibilidadEtapa[0].finAt, 'etapa anterior cerrada');
    assert.equal(db.unidadIndisponibilidadEtapa[1].etapa, 'REPARACION_EN_CURSO');
    assert.ok(!db.unidadIndisponibilidadEtapa[1].finAt, 'etapa nueva vigente');
  });

  it('D) cambiarEtapa idempotente: misma etapa sin comentario = sinCambio', async () => {
    const { tx, db } = base({
      unidadIndisponibilidad: [{ id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA', inicioAt: new Date(), workOrderIds: [] }],
      unidadIndisponibilidadEtapa: [{ id: 'et1', tenantId: T, indisponibilidadId: 'ep1', etapa: 'OTRO', inicioAt: new Date(), finAt: null }],
    });
    const r: any = await cambiarEtapa(tx, { tenantId: T, indisponibilidadId: 'ep1', etapa: 'OTRO' });
    assert.equal(r.sinCambio, true);
    assert.equal(db.unidadIndisponibilidadEtapa.length, 1);
  });

  it('E) abrir rechaza unidad dada de BAJA', async () => {
    const { tx } = prismaFalso({ vehiculo: [{ ...VEH, status: 'BAJA' }] });
    const r: any = await abrirIndisponibilidad(tx, { tenantId: T, vehiculoId: 'v1', origen: 'MANUAL', etapa: 'OTRO' });
    assert.equal(r.code, 409);
  });

  it('F) sync derivados nunca pisa INACTIVO administrativo', async () => {
    const { tx, db } = base();
    db.vehiculo[0].status = 'INACTIVO';
    const r: any = await abrirIndisponibilidad(tx, { tenantId: T, vehiculoId: 'v1', origen: 'MANUAL', etapa: 'OTRO' });
    assert.ok(!r.error);
    assert.equal(db.vehiculo[0].status, 'INACTIVO', 'la situación administrativa no cambia');
    assert.equal(db.vehiculo[0].estadoOperativo, 'EN_TALLER');
  });
});

// ═══ CIERRE ═══
describe('UnidadEstado — cierre del episodio', () => {
  // Factory: cada test recibe filas frescas (el prisma falso muta los objetos)
  const epBase = () => ({
    unidadIndisponibilidad: [{ id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA', inicioAt: new Date('2026-01-10'), workOrderIds: [] }],
    unidadIndisponibilidadEtapa: [{ id: 'et1', tenantId: T, indisponibilidadId: 'ep1', etapa: 'REPARACION_EN_CURSO', inicioAt: new Date('2026-01-10'), finAt: null }],
  });

  it('G) declarar disponible bloquea con restricción activa (no la levanta)', async () => {
    const { tx, db } = base({
      ...epBase(),
      restriccionServicio: [{ id: 'r1', tenantId: T, vehiculoId: 'v1', activa: true, motivo: 'frenos', casoId: null }],
    });
    const r: any = await cerrarIndisponibilidadManual(tx, { tenantId: T, vehiculoId: 'v1', usuario: { nombre: 'Jefe' } });
    assert.equal(r.code, 409);
    assert.match(r.error, /restricc/i);
    assert.equal(db.unidadIndisponibilidad[0].estado, 'ABIERTA', 'el episodio sigue abierto');
    assert.equal(db.restriccionServicio[0].activa, true, 'la restricción NO se levantó');
  });

  it('H) declarar disponible bloquea con OT retiraDeServicio abierta', async () => {
    const { tx } = base({
      ...epBase(),
      workOrder: [{ id: 'ot1', tenantId: T, assetId: 'a1', code: 'OT-1', status: 'IN_PROGRESS', retiraDeServicio: true }],
    });
    const r: any = await cerrarIndisponibilidadManual(tx, { tenantId: T, vehiculoId: 'v1', usuario: {} });
    assert.equal(r.code, 409);
    assert.match(r.error, /OT/);
  });

  it('I) sin causas el cierre cierra episodio + etapa y restaura OPERATIVO', async () => {
    const { tx, db } = base(epBase());
    db.vehiculo[0].estadoOperativo = 'EN_REPARACION';
    db.vehiculo[0].status = 'EN_TALLER';
    db.maintenanceAsset[0].status = 'MAINTENANCE';
    const r: any = await cerrarIndisponibilidadManual(tx, { tenantId: T, vehiculoId: 'v1', usuario: { nombre: 'Jefe' }, motivo: 'verificado' });
    assert.ok(!r.error);
    assert.equal(db.unidadIndisponibilidad[0].estado, 'CERRADA');
    assert.ok(db.unidadIndisponibilidad[0].finAt);
    assert.ok(db.unidadIndisponibilidadEtapa[0].finAt, 'etapa vigente cerrada');
    assert.equal(db.vehiculo[0].estadoOperativo, 'OPERATIVO');
    assert.equal(db.vehiculo[0].status, 'ACTIVO');
    assert.equal(db.maintenanceAsset[0].status, 'ACTIVE');
  });

  it('J) evaluar con restricción pendiente mueve etapa a PENDIENTE_VERIFICACION', async () => {
    const { tx, db } = base({
      ...epBase(),
      restriccionServicio: [{ id: 'r1', tenantId: T, vehiculoId: 'v1', activa: true, motivo: 'frenos', casoId: 'c1' }],
      defectoCaso: [{ id: 'c1', tenantId: T, vehiculoId: 'v1', estado: 'REPARADO_INFORMADO' }],
    });
    const r: any = await evaluarYCerrarIndisponibilidad(tx, { tenantId: T, vehiculoId: 'v1' });
    assert.equal(r.cerrado, false);
    assert.equal(db.unidadIndisponibilidad[0].estado, 'ABIERTA');
    const vigente = db.unidadIndisponibilidadEtapa.find((e: any) => !e.finAt);
    assert.equal(vigente.etapa, 'PENDIENTE_VERIFICACION');
  });

  it('K) caso verificado con restricción activa → etapa PENDIENTE_HABILITACION', async () => {
    const { tx, db } = base({
      ...epBase(),
      restriccionServicio: [{ id: 'r1', tenantId: T, vehiculoId: 'v1', activa: true, motivo: 'frenos', casoId: 'c1' }],
      defectoCaso: [{ id: 'c1', tenantId: T, vehiculoId: 'v1', estado: 'VERIFICADO' }],
    });
    const r: any = await evaluarYCerrarIndisponibilidad(tx, { tenantId: T, vehiculoId: 'v1' });
    assert.equal(r.cerrado, false);
    const vigente = db.unidadIndisponibilidadEtapa.find((e: any) => !e.finAt);
    assert.equal(vigente.etapa, 'PENDIENTE_HABILITACION');
  });

  it('L) OT completada + sin restricciones → evaluar cierra el episodio', async () => {
    const { tx, db } = base({
      ...epBase(),
      workOrder: [{ id: 'ot1', tenantId: T, assetId: 'a1', code: 'OT-1', status: 'COMPLETED', retiraDeServicio: true }],
    });
    const r: any = await evaluarYCerrarIndisponibilidad(tx, { tenantId: T, vehiculoId: 'v1' });
    assert.equal(r.cerrado, true);
    assert.equal(db.unidadIndisponibilidad[0].estado, 'CERRADA');
  });
});

// ═══ IMPEDIMENTOS DE SERVICIO ═══
describe('UnidadEstado — impedimentosParaServicio', () => {
  it('M) episodio abierto o restricción activa bloquean el inicio', async () => {
    const { tx } = base({
      unidadIndisponibilidad: [{ id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA', inicioAt: new Date(), workOrderIds: [] }],
      unidadIndisponibilidadEtapa: [{ id: 'et1', tenantId: T, indisponibilidadId: 'ep1', etapa: 'ESPERANDO_REPUESTO', inicioAt: new Date(), finAt: null }],
    });
    const r = await impedimentosParaServicio(tx, T, VEH);
    assert.equal(r.ok, false);
    assert.ok(r.motivos.some((m: string) => m.includes('fuera de servicio')));

    const { tx: tx2 } = base({
      restriccionServicio: [{ id: 'r1', tenantId: T, vehiculoId: 'v1', activa: true, motivo: 'frenos' }],
    });
    const r2 = await impedimentosParaServicio(tx2, T, VEH);
    assert.equal(r2.ok, false);
    assert.ok(r2.motivos.some((m: string) => m.includes('restricción')));
  });

  it('N) unidad BAJA/INACTIVA bloquea; unidad sana pasa', async () => {
    const { tx } = base();
    const baja = await impedimentosParaServicio(tx, T, { ...VEH, status: 'BAJA' });
    assert.equal(baja.ok, false);
    const inactiva = await impedimentosParaServicio(tx, T, { ...VEH, status: 'INACTIVO' });
    assert.equal(inactiva.ok, false);
    const sana = await impedimentosParaServicio(tx, T, VEH);
    assert.equal(sana.ok, true);
    assert.deepEqual(sana.motivos, []);
  });
});

// ═══ UBICACIÓN + TALLER ═══
describe('UnidadEstado — ubicación y taller', () => {
  it('O) ingreso a taller registra ubicación TALLER_EXTERNO; salida la deja SIN_DATOS', async () => {
    const { tx, db } = base({
      unidadIndisponibilidad: [{ id: 'ep1', tenantId: T, vehiculoId: 'v1', estado: 'ABIERTA', inicioAt: new Date(), workOrderIds: [] }],
    });
    await registrarIngresoTaller(tx, {
      tenantId: T, indisponibilidadId: 'ep1', tallerTipo: 'EXTERNO', tallerNombre: 'Taller Sur',
    });
    assert.ok(db.unidadIndisponibilidad[0].fechaIngresoTaller);
    assert.equal(db.vehiculo[0].ubicacionTipo, 'TALLER_EXTERNO');
    assert.equal(db.vehiculo[0].ubicacionDetalle, 'Taller Sur');
    assert.equal(db.vehiculoUbicacionEvento.length, 1);

    await registrarSalidaTaller(tx, { tenantId: T, indisponibilidadId: 'ep1' });
    assert.ok(db.unidadIndisponibilidad[0].fechaSalidaTaller);
    assert.equal(db.vehiculo[0].ubicacionTipo, null, 'no se inventa la ubicación posterior');
    assert.equal(db.vehiculoUbicacionEvento[1].tipo, 'SIN_DATOS');
  });
});

// ═══ ESTADO COMPUESTO ═══
describe('UnidadEstado — componerEstado (etiqueta por dimensiones)', () => {
  const vehOk = { ...VEH, ubicacionTipo: null, ubicacionDetalle: null };
  const ep = (etapa: string, fechaIngresoTaller?: Date) => ({
    id: 'ep1', fechaIngresoTaller: fechaIngresoTaller ?? null,
    etapas: [{ etapa, inicioAt: new Date(), finAt: null }],
  });

  it('P) etiquetas: disponible, en servicio, en taller, restringida, verificada', () => {
    // Disponible sin datos de uso
    const disp = componerEstado({ vehiculo: vehOk });
    assert.equal(disp.disponible, true);
    assert.match(disp.etiqueta, /Disponible/);

    // En servicio
    const serv = componerEstado({ vehiculo: vehOk, enServicio: true });
    assert.equal(serv.etiqueta, 'En servicio');

    // Episodio en reparación con ingreso a taller
    const taller = componerEstado({
      vehiculo: vehOk, episodio: ep('REPARACION_EN_CURSO', new Date()),
    });
    assert.equal(taller.disponible, false);
    assert.match(taller.etiqueta, /En taller · Reparación en curso/);
    assert.equal(taller.enTallerEfectivo, true);

    // Episodio + restricción → menciona ambas dimensiones
    const restr = componerEstado({
      vehiculo: vehOk, episodio: ep('REPARACION_EN_CURSO'),
      restricciones: [{ id: 'r1', motivo: 'frenos' }],
    });
    assert.match(restr.etiqueta, /Restringida/);
    assert.equal(restr.restringida, true);

    // Etapa verificada → etiqueta distinta de "en taller"
    const verif = componerEstado({ vehiculo: vehOk, episodio: ep('PENDIENTE_HABILITACION') });
    assert.match(verif.etiqueta, /Verificada/);
    assert.equal(verif.etapaLabel, ETAPA_LABEL.PENDIENTE_HABILITACION);

    // Inconsistencia explícita: en servicio con episodio abierto
    const incons = componerEstado({ vehiculo: vehOk, episodio: ep('OTRO'), enServicio: true });
    assert.ok(incons.advertencias.length > 0);
  });
});
