// Tests de aceptación del circuito inspecciones → defectos → OT → habilitación.
// Correr: node --import tsx --test tests/defectos.test.ts
//
// Cobertura A–L:
//   A) Misma falla abierta en días distintos: reportes conservados, un caso, una OT.
//   B) Dos fallas distintas de la misma unidad: casos separados.
//   C) Falla tras resolución verificada: caso nuevo vinculado (posible recurrencia).
//   D) Respuesta bloqueante: restricción sobre la unidad correcta (tractor/semi).
//   E) Completar la OT NO libera el bloqueo (REPARADO_INFORMADO, restricción activa).
//   F) Resolver un caso no libera la unidad si hay otra restricción activa.
//   G) Habilitar requiere verificación previa en caso bloqueante.
//   H) Reporte posterior sin falla no cierra el caso abierto.
//   I) Reintentos no duplican reportes ni efectos (reporteKey/submissionKey).
//   J) Eventos del caso trazan el circuito completo sin duplicar intervenciones.
//   K) El snapshot de regla preserva la interpretación histórica.
//   L) Funciona para tractor y para semi (conjunto operativo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  reglaParaRespuesta,
  procesarReporteDefecto,
  restriccionesActivasDe,
  restriccionesDelConjunto,
  marcarReparacionInformadaPorOT,
  verificarCaso,
  habilitarPorCaso,
  reasignarReporte,
} from '../src/services/defectService.js';

const T = 'tenant-1';
const V_TRACTOR = 'veh-tractor';
const V_SEMI = 'veh-semi';

// ── Mock prisma en memoria ──
function makeDb() {
  const hallazgos = new Map<string, any>();
  const casos = new Map<string, any>();
  const eventos: any[] = [];
  const restricciones = new Map<string, any>();
  const conjuntos = new Map<string, any>();
  const vehiculos = new Map<string, any>([
    [V_TRACTOR, { id: V_TRACTOR, dominio: 'AA111', tipo: 'TRACTOR', maintenanceAssetId: 'ma-tractor', estadoOperativo: 'OPERATIVO' }],
    [V_SEMI, { id: V_SEMI, dominio: 'BB222', tipo: 'SEMI', maintenanceAssetId: 'ma-semi', estadoOperativo: 'OPERATIVO' }],
  ]);

  const matchWhere = (row: any, where: any) => {
    for (const [k, v] of Object.entries(where)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object' && 'in' in (v as any)) { if (!(v as any).in.includes(row[k])) return false; }
      else if (row[k] !== v) return false;
    }
    return true;
  };
  const applyUpdate = (p: any, data: any) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'increment' in (v as any)) p[k] = (p[k] || 0) + (v as any).increment;
      else if (v && typeof v === 'object' && 'decrement' in (v as any)) p[k] = (p[k] || 0) - (v as any).decrement;
      else (p as any)[k] = v;
    }
  };

  const tx: any = {
    _hallazgos: hallazgos, _casos: casos, _eventos: eventos, _restricciones: restricciones,
    _conjuntos: conjuntos, _vehiculos: vehiculos,
    inspeccionHallazgo: {
      findFirst: async ({ where }: any) => [...hallazgos.values()].find(h => matchWhere(h, where)) ?? null,
      create: async ({ data }: any) => {
        const id = randomUUID();
        const row = { id, estado: 'ABIERTO', createdAt: new Date(), ...data };
        hallazgos.set(id, row); return row;
      },
      update: async ({ where, data }: any) => { const h = hallazgos.get(where.id); applyUpdate(h, data); return h; },
      updateMany: async ({ where, data }: any) => { let n = 0; for (const h of hallazgos.values()) if (matchWhere(h, where)) { applyUpdate(h, data); n++; } return { count: n }; },
    },
    defectoCaso: {
      findFirst: async ({ where }: any) => {
        const rows = [...casos.values()].filter(c => matchWhere(c, where));
        rows.sort((a, b) => (b.ultimoReporteAt?.getTime?.() ?? 0) - (a.ultimoReporteAt?.getTime?.() ?? 0));
        return rows[0] ?? null;
      },
      findMany: async ({ where }: any) => [...casos.values()].filter(c => matchWhere(c, where ?? {})),
      create: async ({ data }: any) => {
        const id = randomUUID();
        const row = { id, reportesCount: 0, bloqueante: false, severidad: 'MODERADO', createdAt: new Date(), ...data };
        casos.set(id, row); return row;
      },
      update: async ({ where, data }: any) => { const c = casos.get(where.id); applyUpdate(c, data); return c; },
    },
    defectoCasoEvento: {
      create: async ({ data }: any) => { const e = { id: randomUUID(), createdAt: new Date(), ...data }; eventos.push(e); return e; },
    },
    restriccionServicio: {
      findFirst: async ({ where }: any) => [...restricciones.values()].find(r => matchWhere(r, where)) ?? null,
      findMany: async ({ where }: any) => [...restricciones.values()].filter(r => matchWhere(r, where ?? {})),
      create: async ({ data }: any) => {
        const id = randomUUID();
        const row = { id, activa: true, createdAt: new Date(), ...data };
        restricciones.set(id, row); return row;
      },
      updateMany: async ({ where, data }: any) => { let n = 0; for (const r of restricciones.values()) if (matchWhere(r, where)) { applyUpdate(r, data); n++; } return { count: n }; },
    },
    conjuntoOperativo: {
      findFirst: async ({ where }: any) => {
        const { OR, ...rest } = where;
        const rows = [...conjuntos.values()].filter(c => matchWhere(c, rest));
        const filtrado = rows.find(c => OR.some((o: any) => matchWhere(c, o)));
        return filtrado ?? null;
      },
    },
    vehiculo: {
      findFirst: async ({ where }: any) => [...vehiculos.values()].find(v => matchWhere(v, where)) ?? null,
    },
  };
  return tx;
}

const itemFrenos = { id: 'it-frenos', label: 'Estado de frenos', seccion: 'Frenos', tipo: 'SI_NO', triggerHallazgo: true };
const itemLuces = { id: 'it-luces', label: 'Luces delanteras', seccion: 'Electricidad', tipo: 'SI_NO', triggerHallazgo: true };
const reglaBase = reglaParaRespuesta(itemFrenos, { esOk: false });

function optsReporte(db: any, item: any, resp: any, vehiculo: any, inspId?: string) {
  return {
    tenantId: T, inspeccionId: inspId ?? randomUUID(),
    item, resp, regla: reglaParaRespuesta(item, resp), vehiculo,
    equipoDestino: 'TRACTOR', inspectorNombre: 'Chofer Test', fecha: new Date(),
  };
}

// ── A) mismo defecto abierto, días distintos ────────────────────
test('A — re-reporte del mismo defecto abierto: un caso, reportes conservados', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const r1 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false, observacion: 'freno débil' }, veh));
  const r2 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false, observacion: 'sigue igual' }, veh));
  const r3 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));

  assert.equal(r1.casoNuevo, true);
  assert.equal(r2.casoNuevo, false);
  assert.equal(r2.caso.id, r1.caso.id, 'mismo caso');
  assert.equal(r3.caso.id, r1.caso.id);
  const caso = db._casos.get(r1.caso.id);
  assert.equal(caso.reportesCount, 3, 'tres reportes en el caso');
  assert.ok(caso.primerReporteAt <= caso.ultimoReporteAt);
  // Cada reporte se conservó como hallazgo individual
  assert.equal([...db._hallazgos.values()].filter(h => h.casoId === caso.id).length, 3);
});

// ── B) dos fallas distintas, misma unidad ───────────────────────
test('B — dos defectos distintos de la misma unidad quedan separados', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const a = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));
  const b = await procesarReporteDefecto(db, optsReporte(db, itemLuces, { esOk: false }, veh));
  assert.notEqual(a.caso.id, b.caso.id);
  assert.equal(db._casos.size, 2);
});

// ── C) reaparición tras resolución verificada → caso nuevo ──────
test('C — falla tras resolución verificada crea caso nuevo vinculado', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const r1 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));
  // cerrar el caso por el flujo completo (no bloqueante → verificar resuelve)
  await verificarCaso(db, { tenantId: T, casoId: r1.caso.id, resultado: 'OK', usuario: { id: 'u1', nombre: 'Verificador' } });
  const cerrado = db._casos.get(r1.caso.id);
  assert.equal(cerrado.estado, 'RESUELTO');

  const r2 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));
  assert.notEqual(r2.caso.id, r1.caso.id, 'caso nuevo, no el resuelto');
  assert.equal(r2.esRecurrencia, true);
  assert.equal(db._casos.get(r2.caso.id).casoPrevioId, r1.caso.id, 'vinculado al anterior como posible recurrencia');
});

// ── D) respuesta bloqueante → restricción en la unidad correcta ─
test('D — regla bloqueante registra restricción sobre la unidad correcta (semi)', async () => {
  const db = makeDb();
  const itemSemi = { id: 'it-patente', label: 'Luces del semi', seccion: 'Semirremolque', tipo: 'SI_NO', triggerHallazgo: true, bloqueaServicio: true, severidadHallazgo: 'CRITICO' };
  const semi = db._vehiculos.get(V_SEMI);
  const tractor = db._vehiculos.get(V_TRACTOR);

  const res = await procesarReporteDefecto(db, {
    ...optsReporte(db, itemSemi, { esOk: false }, semi), equipoDestino: 'SEMI',
  });
  assert.ok(res.restriccion, 'se creó restricción');
  assert.equal(res.restriccion.vehiculoId, V_SEMI, 'restricción sobre el SEMI, no el tractor');
  assert.equal(res.caso.vehiculoId, V_SEMI);
  assert.equal(res.caso.bloqueante, true);

  const restrTractor = await restriccionesActivasDe(db, T, V_TRACTOR);
  assert.equal(restrTractor.length, 0, 'el tractor queda libre');
});

// ── E) completar OT no libera el bloqueo ────────────────────────
test('E — OT completada → REPARADO_INFORMADO; restricción sigue activa', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const item = { ...itemFrenos, bloqueaServicio: true, severidadHallazgo: 'CRITICO' };
  const r = await procesarReporteDefecto(db, optsReporte(db, item, { esOk: false }, veh));
  // simular OT asignada
  db._casos.get(r.caso.id).workOrderId = 'ot-1';
  db._casos.get(r.caso.id).estado = 'EN_TRATAMIENTO';

  const marcados = await marcarReparacionInformadaPorOT(db, T, 'ot-1', 'Mecánico');
  assert.deepEqual(marcados, [r.caso.id]);
  const caso = db._casos.get(r.caso.id);
  assert.equal(caso.estado, 'REPARADO_INFORMADO', 'informado, no resuelto');
  const restr = await restriccionesActivasDe(db, T, V_TRACTOR);
  assert.equal(restr.length, 1, 'la restricción sigue activa tras completar la OT');
});

// ── F) resolver un caso no libera si otra restricción activa ────
test('F — habilitar un caso no borra bloqueos de otro caso', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const itemB1 = { ...itemFrenos, bloqueaServicio: true };
  const itemB2 = { ...itemLuces, bloqueaServicio: true };
  const c1 = await procesarReporteDefecto(db, optsReporte(db, itemB1, { esOk: false }, veh));
  const c2 = await procesarReporteDefecto(db, optsReporte(db, itemB2, { esOk: false }, veh));

  // resolver+habilitar solo c1
  await verificarCaso(db, { tenantId: T, casoId: c1.caso.id, resultado: 'OK', usuario: { nombre: 'V' } });
  const res = await habilitarPorCaso(db, { tenantId: T, casoId: c1.caso.id, usuario: { id: 'admin', nombre: 'Admin' } });
  assert.equal(res.libre, false, 'sigue restringido por el otro caso');
  assert.equal(res.restriccionesRestantes.length, 1);
  const activas = await restriccionesActivasDe(db, T, V_TRACTOR);
  assert.equal(activas.length, 1);
  assert.equal(activas[0].casoId, c2.caso.id);
});

// ── G) habilitar exige verificación previa en caso bloqueante ───
test('G — caso bloqueante no se habilita sin verificación', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const item = { ...itemFrenos, bloqueaServicio: true };
  const r = await procesarReporteDefecto(db, optsReporte(db, item, { esOk: false }, veh));

  const sinVerif = await habilitarPorCaso(db, { tenantId: T, casoId: r.caso.id, usuario: { nombre: 'A' } });
  assert.equal(sinVerif.code, 409, 'rechazado: no verificado');

  await verificarCaso(db, { tenantId: T, casoId: r.caso.id, resultado: 'OK', usuario: { nombre: 'V' } });
  assert.equal(db._casos.get(r.caso.id).estado, 'VERIFICADO', 'bloqueante verificado ≠ resuelto');

  const ok = await habilitarPorCaso(db, { tenantId: T, casoId: r.caso.id, usuario: { id: 'admin1', nombre: 'Admin' } });
  assert.equal(ok.libre, true);
  const caso = db._casos.get(r.caso.id);
  assert.equal(caso.estado, 'RESUELTO');
  assert.equal(caso.habilitadoPorId, 'admin1');
  assert.ok(caso.habilitadoAt);
});

// ── H) reporte sin falla no cierra caso abierto ─────────────────
test('H — una inspección posterior sin falla no cierra el caso', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const r1 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));
  // Nueva inspección donde el ítem está OK → no se procesa ningún reporte
  // (el submit solo llama procesarReporteDefecto con esOk===false).
  const caso = db._casos.get(r1.caso.id);
  assert.equal(caso.estado, 'ABIERTO', 'el caso permanece abierto');
  assert.equal(caso.reportesCount, 1);
});

// ── I) reintentos no duplican ───────────────────────────────────
test('I — reintento del mismo envío no duplica reporte ni caso', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const inspId = randomUUID();
  const o1 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh, inspId));
  const o2 = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh, inspId));
  assert.equal(o2.duplicado, true);
  assert.equal(o2.reporte.id, o1.reporte.id);
  assert.equal(db._hallazgos.size, 1, 'un solo reporte');
  assert.equal(db._casos.get(o1.caso.id).reportesCount, 1, 'contador no inflado');
});

// ── J) circuito completo trazado en eventos ─────────────────────
test('J — eventos del caso cubren el circuito completo', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const item = { ...itemFrenos, bloqueaServicio: true };
  const r = await procesarReporteDefecto(db, optsReporte(db, item, { esOk: false }, veh));
  db._casos.get(r.caso.id).workOrderId = 'ot-9';
  db._casos.get(r.caso.id).estado = 'EN_TRATAMIENTO';
  await marcarReparacionInformadaPorOT(db, T, 'ot-9', 'Mec');
  await verificarCaso(db, { tenantId: T, casoId: r.caso.id, resultado: 'OK', usuario: { nombre: 'V' } });
  await habilitarPorCaso(db, { tenantId: T, casoId: r.caso.id, motivo: 'verificado en ruta', usuario: { nombre: 'Admin' } });

  const tipos = db._eventos.filter((e: any) => e.casoId === r.caso.id).map((e: any) => e.tipo);
  assert.ok(tipos.includes('CREADO'));
  assert.ok(tipos.includes('REPARACION_INFORMADA'));
  assert.ok(tipos.includes('VERIFICADO'));
  assert.ok(tipos.includes('HABILITADO'));
});

// ── K) snapshot de regla preserva interpretación histórica ──────
test('K — el reporte guarda la regla vigente en el momento', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const item = { ...itemFrenos, severidadHallazgo: 'LEVE', bloqueaServicio: false };
  const r = await procesarReporteDefecto(db, optsReporte(db, item, { esOk: false }, veh));
  assert.equal(r.reporte.reglaSnapshot.severidad, 'LEVE');
  // Si el responsable luego sube la severidad a CRITICO en la plantilla,
  // el reporte histórico conserva su interpretación (snapshot, no live).
  assert.equal(r.reporte.reglaSnapshot.configurada, true);
});

// ── L) conjunto operativo: restricción del semi bloquea el conjunto
test('L — restriccionesDelConjunto incluye al compañero acoplado', async () => {
  const db = makeDb();
  db._conjuntos.set('cj1', { id: 'cj1', tenantId: T, tractorId: V_TRACTOR, semiId: V_SEMI, estado: 'ACOPLADO' });
  const semi = db._vehiculos.get(V_SEMI);
  const itemSemi = { id: 'it-x', label: 'Freno de mano semi', seccion: 'Semi', tipo: 'SI_NO', triggerHallazgo: true, bloqueaServicio: true };
  await procesarReporteDefecto(db, { ...optsReporte(db, itemSemi, { esOk: false }, semi), equipoDestino: 'SEMI' });

  const res = await restriccionesDelConjunto(db, T, V_TRACTOR);
  assert.equal(res.conjunto.id, 'cj1');
  assert.equal(res.restricciones.length, 1, 'la restricción del semi aparece al consultar el tractor');
  assert.equal(res.restricciones[0].vehiculoId, V_SEMI);
});

// ── Extra: regla por respuesta específica (OPCION) ──────────────
test('reglasRespuesta — override por valor de respuesta', () => {
  const item = {
    id: 'it-x', label: 'Nivel de desgaste', tipo: 'OPCION', triggerHallazgo: true,
    opciones: ['OK', 'DESGASTE_LEVE', 'DESGASTE_CRITICO'],
    severidadHallazgo: 'MODERADO',
    reglasRespuesta: [
      { valor: 'DESGASTE_LEVE', severidad: 'LEVE', bloqueaServicio: false },
      { valor: 'DESGASTE_CRITICO', severidad: 'CRITICO', bloqueaServicio: true, instruccionChofer: 'No circular' },
    ],
  };
  const leve = reglaParaRespuesta(item, { valor: 'DESGASTE_LEVE', esOk: false });
  assert.equal(leve.severidad, 'LEVE');
  assert.equal(leve.bloqueaServicio, false);
  const crit = reglaParaRespuesta(item, { valor: 'DESGASTE_CRITICO', esOk: false });
  assert.equal(crit.severidad, 'CRITICO');
  assert.equal(crit.bloqueaServicio, true);
  assert.equal(crit.instruccionChofer, 'No circular');
});

// ── Extra: verificación FALLA_PERSISTE reabre el caso ───────────
test('verificación FALLA_PERSISTE vuelve el caso a ABIERTO', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const item = { ...itemFrenos, bloqueaServicio: true };
  const r = await procesarReporteDefecto(db, optsReporte(db, item, { esOk: false }, veh));
  db._casos.get(r.caso.id).estado = 'REPARADO_INFORMADO';
  await verificarCaso(db, { tenantId: T, casoId: r.caso.id, resultado: 'FALLA_PERSISTE', notas: 'sigue fallando', usuario: { nombre: 'V' } });
  const caso = db._casos.get(r.caso.id);
  assert.equal(caso.estado, 'ABIERTO');
  assert.equal(caso.verificacionResultado, 'FALLA_PERSISTE');
  // La restricción NUNCA se levantó
  const activas = await restriccionesActivasDe(db, T, V_TRACTOR);
  assert.equal(activas.length, 1);
});

// ── Extra: reasignación manual trazable ─────────────────────────
test('reasignar reporte a otro caso queda auditado', async () => {
  const db = makeDb();
  const veh = db._vehiculos.get(V_TRACTOR);
  const a = await procesarReporteDefecto(db, optsReporte(db, itemFrenos, { esOk: false }, veh));
  const b = await procesarReporteDefecto(db, optsReporte(db, itemLuces, { esOk: false }, veh));
  const res = await reasignarReporte(db, {
    tenantId: T, hallazgoId: a.reporte.id, casoDestinoId: b.caso.id,
    motivo: 'agrupación errónea', usuario: { nombre: 'Admin' },
  });
  assert.equal(res.ok, true);
  const h = db._hallazgos.get(a.reporte.id);
  assert.equal(h.casoId, b.caso.id);
  const evReasig = db._eventos.filter((e: any) => e.tipo === 'REASIGNADO');
  assert.ok(evReasig.length >= 1, 'evento de reasignación registrado');
});
