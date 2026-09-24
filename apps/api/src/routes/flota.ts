import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { notifyBandaCritica } from '../services/notifyService.js';
import { proyectarVehiculo } from '../services/fleetProjection.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export default async function flotaRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════
  // VEHÍCULOS
  // ═══════════════════════════════════════════════════════════════

  // POST /vehiculos/:id/eliminar - PRIMERO (antes de cualquier /vehiculos/:id)
  app.post('/vehiculos/:id/eliminar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id, tenantId },
      include: { posicionesNeumatico: true, registrosCombustible: { take: 1 }, vencimientos: { take: 1 } }
    });

    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Verificar si tiene neumáticos montados
    const tieneNeumaticosMontados = vehiculo.posicionesNeumatico?.some((p: any) => p.activo);
    if (tieneNeumaticosMontados) {
      return reply.code(400).send({ error: 'Tiene neumáticos montados. Desmontelos primero.' });
    }

    // Eliminar datos relacionados
    await (app.prisma as any).neumaticoPosicion.deleteMany({ where: { vehiculoId: id, tenantId } });
    await (app.prisma as any).vencimientoDocumento.deleteMany({ where: { vehiculoId: id, tenantId } });
    await (app.prisma as any).vehiculoHistorialMantenimiento.deleteMany({ where: { vehiculoId: id, tenantId } });
    await (app.prisma as any).garantiaVehiculo.deleteMany({ where: { vehiculoId: id, tenantId } });

    // Eliminar activo de mantenimiento si está vacío
    if (vehiculo.maintenanceAssetId) {
      const assetData = await (app.prisma as any).maintenanceAsset.findFirst({
        where: { id: vehiculo.maintenanceAssetId, tenantId },
        include: { workOrders: { take: 1 }, costs: { take: 1 } }
      });
      if (!assetData?.workOrders?.length && !assetData?.costs?.length) {
        await (app.prisma as any).assetDigitalTwin.deleteMany({ where: { assetId: vehiculo.maintenanceAssetId, tenantId } });
        await (app.prisma as any).maintenanceAsset.deleteMany({ where: { id: vehiculo.maintenanceAssetId, tenantId } });
      }
    }

    // Eliminar vehículo físicamente
    await (app.prisma as any).vehiculo.deleteMany({ where: { id, tenantId } });

    return reply.send({ ok: true, mensaje: 'Vehículo eliminado permanentemente' });
  });

  // GET /vehiculos/:id/twin — Gemelo Digital predictivo (calculado en tiempo real)
  app.get('/vehiculos/:id/twin', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id, tenantId },
      include: {
        vencimientos: true,
        registrosCombustible: { orderBy: { fecha: 'desc' }, take: 20 },
        posicionesNeumatico: { where: { activo: true }, include: { neumatico: true } },
      }
    });
    if (!vehiculo) return reply.code(404).send({ error: 'No encontrado' });

    // Obtener órdenes de trabajo si tiene activo vinculado
    let workOrders: any[] = [];
    if (vehiculo.maintenanceAssetId) {
      workOrders = await (app.prisma as any).workOrder.findMany({
        where: { assetId: vehiculo.maintenanceAssetId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []);
    }

    const now = new Date();
    const km = vehiculo.currentOdometer || 0;
    const regs: any[] = vehiculo.registrosCombustible || [];
    const vencimientos: any[] = vehiculo.vencimientos || [];
    const neumaticos: any[] = vehiculo.posicionesNeumatico || [];

    // ── MOTOR: basado en km desde último servicio (intervalo 10.000 km) ──
    const lastService = workOrders.find((wo: any) =>
      (wo.description || wo.title || '').toLowerCase().match(/aceite|service|preventivo|filtro/)
    );
    const kmSinceService = lastService
      ? Math.max(0, km - (lastService.odometerReading || 0))
      : km % 10000;
    const intervaloService = 10000;
    const motorSalud = Math.max(5, Math.round(100 - Math.min((kmSinceService / intervaloService) * 100, 95)));
    const motorKmRestantes = Math.max(0, intervaloService - kmSinceService);

    // ── FRENOS: intervalo 30.000 km ──
    const kmSinceBrakes = km % 30000;
    const frenosSalud = Math.max(5, Math.round(100 - Math.min((kmSinceBrakes / 30000) * 100, 95)));
    const frenosKmRestantes = Math.max(0, 30000 - kmSinceBrakes);

    // ── NEUMÁTICOS: basado en la cubierta MÁS gastada (min profBanda, no promedio) ──
    // Una sola cubierta crítica no debe quedar diluida en el promedio del resto.
    let neumSalud = 80;
    let neumMinBanda: number | null = null;
    if (neumaticos.length > 0) {
      const bandas = neumaticos.map((p: any) => p.neumatico?.profBanda ?? 6).filter((b: number) => b > 0);
      if (bandas.length > 0) {
        neumMinBanda = Math.min(...bandas);
        neumSalud = Math.max(5, Math.min(100, Math.round(((neumMinBanda - 1.6) / (8 - 1.6)) * 100)));
      }
    }

    // ── DOCUMENTACIÓN ──
    const docsActivos = vencimientos.filter((v: any) => !v.renovado);
    const docsVencidos = docsActivos.filter((v: any) => new Date(v.fechaVto) < now);
    const docsPorVencer = docsActivos.filter((v: any) => {
      const dias = Math.ceil((new Date(v.fechaVto).getTime() - now.getTime()) / 86400000);
      return dias >= 0 && dias <= 30;
    });
    const docSalud = Math.max(0, 100 - docsVencidos.length * 35 - docsPorVencer.length * 15);

    // ── COMBUSTIBLE: eficiencia (L/100km) ──
    let combSalud = 85;
    let l100km: number | null = null;
    if (regs.length >= 2) {
      const withOdo = regs.filter((r: any) => r.odometro && r.litros);
      if (withOdo.length >= 2) {
        const totalLitros = withOdo.slice(0, 5).reduce((s: number, r: any) => s + r.litros, 0);
        const kmRecorridos = withOdo[0].odometro - withOdo[Math.min(4, withOdo.length - 1)].odometro;
        if (kmRecorridos > 0) {
          l100km = Math.round((totalLitros / kmRecorridos) * 100 * 10) / 10;
          // Camión: referencia 30L/100km. Más bajo = mejor.
          combSalud = Math.max(10, Math.min(100, Math.round(100 - Math.max(0, l100km - 28) * 3)));
        }
      }
    }

    // ── SCORE GLOBAL ──
    const healthScore = Math.round(motorSalud * 0.30 + frenosSalud * 0.20 + neumSalud * 0.20 + docSalud * 0.20 + combSalud * 0.10);
    const riskScore = 100 - healthScore;
    const estadoGeneral = healthScore >= 80 ? 'BUENO' : healthScore >= 60 ? 'REGULAR' : healthScore >= 40 ? 'MALO' : 'CRÍTICO';

    // ── ALERTAS ──
    const alertas: any[] = [];
    if (motorSalud < 25) alertas.push({ tipo: 'CRÍTICO', componente: 'Motor', mensaje: `Cambio de aceite/service urgente (${(kmSinceService / 1000).toFixed(1)}k km desde último)` });
    else if (motorSalud < 50) alertas.push({ tipo: 'ALERTA', componente: 'Motor', mensaje: `Próximo service en ${(motorKmRestantes / 1000).toFixed(1)}k km` });
    if (frenosSalud < 25) alertas.push({ tipo: 'CRÍTICO', componente: 'Frenos', mensaje: 'Revisión de sistema de frenos urgente' });
    else if (frenosSalud < 50) alertas.push({ tipo: 'ALERTA', componente: 'Frenos', mensaje: `Revisión de frenos en ${(frenosKmRestantes / 1000).toFixed(1)}k km` });
    if (neumSalud < 30) alertas.push({ tipo: 'CRÍTICO', componente: 'Neumáticos', mensaje: 'Banda de rodamiento crítica — reemplazar' });
    else if (neumSalud < 55) alertas.push({ tipo: 'ALERTA', componente: 'Neumáticos', mensaje: 'Banda de rodamiento baja' });
    docsVencidos.forEach((v: any) => alertas.push({ tipo: 'CRÍTICO', componente: 'Documentación', mensaje: `${v.tipo} VENCIDO` }));
    docsPorVencer.forEach((v: any) => {
      const dias = Math.ceil((new Date(v.fechaVto).getTime() - now.getTime()) / 86400000);
      alertas.push({ tipo: 'ALERTA', componente: 'Documentación', mensaje: `${v.tipo} vence en ${dias} días` });
    });
    if (combSalud < 50 && l100km) alertas.push({ tipo: 'ALERTA', componente: 'Combustible', mensaje: `Consumo elevado: ${l100km} L/100km` });

    // ── PREDICCIÓN próximo servicio ──
    let diasProxServicio: number | null = null;
    if (regs.length >= 2 && km > 0) {
      const kmDia = km / 365;
      if (kmDia > 0) diasProxServicio = Math.round(motorKmRestantes / kmDia);
    }

    // ── Datos operativos adicionales (aditivos): última inspección QR, próximo servicio planificado, costo/km ──
    const esSemi = vehiculo.tipo === 'SEMI';
    const [ultimaInspeccion, planesActivos, costos6m, kmRecorridos6m, historialOTs, reemplazoCfg] = await Promise.all([
      (app.prisma as any).inspeccion.findFirst({
        where: {
          tenantId,
          OR: [
            ...(vehiculo.maintenanceAssetId ? [{ qr: { maintenanceAssetId: vehiculo.maintenanceAssetId } }] : []),
            { dominioTractor: { equals: vehiculo.dominio, mode: 'insensitive' } },
            { dominioSemi: { equals: vehiculo.dominio, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, estado: true, puntaje: true, hallazgosCount: true },
      }).catch(() => null),
      vehiculo.maintenanceAssetId
        ? (app.prisma as any).maintenancePlan.findMany({
            where: { assetId: vehiculo.maintenanceAssetId, tenantId, status: 'ACTIVE' },
            select: { id: true, title: true, frequencyUnit: true, triggerKm: true, lastOdometerExecution: true, nextExecutionDate: true },
          }).catch(() => [])
        : [],
      (async () => {
        const hace6m = new Date(); hace6m.setMonth(hace6m.getMonth() - 6);
        const [comb, ots, neum] = await Promise.all([
          (app.prisma as any).registroCombustible.aggregate({ where: { tenantId, vehiculoId: id, fecha: { gte: hace6m } }, _sum: { costoTotal: true } }),
          vehiculo.maintenanceAssetId
            ? (app.prisma as any).workOrder.aggregate({ where: { tenantId, assetId: vehiculo.maintenanceAssetId, status: 'COMPLETED', completedAt: { gte: hace6m } }, _sum: { totalCost: true } })
            : { _sum: { totalCost: 0 } },
          (app.prisma as any).neumaticoPosicion.findMany({ where: { tenantId, vehiculoId: id, activo: false, desmontadoAt: { gte: hace6m } }, select: { neumatico: { select: { precioCompra: true } } } }),
        ]);
        return (comb._sum.costoTotal || 0) + (ots._sum.totalCost || 0) + neum.reduce((a: number, p: any) => a + (p.neumatico?.precioCompra || 0), 0);
      })().catch(() => 0),
      (async () => {
        const hace6m = new Date(); hace6m.setMonth(hace6m.getMonth() - 6);
        const regs6m = regs.filter((r: any) => new Date(r.fecha) >= hace6m && r.odometro);
        if (regs6m.length >= 2) {
          const ordenados = [...regs6m].sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
          const diff = ordenados[ordenados.length - 1].odometro - ordenados[0].odometro;
          return diff > 0 ? diff : null;
        }
        return null;
      })().catch(() => null),
      // Historial de OTs completadas (24m) para el análisis de reemplazo
      (async () => {
        if (!vehiculo.maintenanceAssetId) return [];
        const hace24m = new Date(); hace24m.setMonth(hace24m.getMonth() - 24);
        return (app.prisma as any).workOrder.findMany({
          where: { tenantId, assetId: vehiculo.maintenanceAssetId, status: 'COMPLETED', completedAt: { gte: hace24m } },
          select: { completedAt: true, totalCost: true, type: true },
        });
      })().catch(() => []),
      // Variables configurables del análisis de reemplazo (defaults si no hay config)
      (app.prisma as any).companySettings.findUnique({ where: { tenantId }, select: { flotaReemplazoConfig: true } }).catch(() => null),
    ]);

    // Próximo servicio planificado real (de MaintenancePlan, no inventado)
    let proximoServicio: any = null;
    for (const p of planesActivos) {
      if (p.frequencyUnit === 'KM' && p.triggerKm && km > 0) {
        const base = p.lastOdometerExecution ?? km;
        const proxKm = base + p.triggerKm;
        const kmRest = Math.round(proxKm - km);
        if (!proximoServicio || kmRest < (proximoServicio.kmRestantes ?? Infinity)) {
          proximoServicio = { plan: p.title, tipo: 'KM', proximoKm: proxKm, kmRestantes: kmRest };
        }
      } else if (p.nextExecutionDate) {
        const dias = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
        if (!proximoServicio || (proximoServicio.tipo === 'FECHA' && dias < proximoServicio.diasRestantes)) {
          proximoServicio = { plan: p.title, tipo: 'FECHA', fecha: p.nextExecutionDate, diasRestantes: dias };
        }
      }
    }

    const costoPorKm = kmRecorridos6m && kmRecorridos6m > 0 ? Math.round((costos6m / kmRecorridos6m) * 100) / 100 : null;
    const diasEnTaller = vehiculo.status === 'EN_TALLER'
      ? Math.max(0, Math.floor((now.getTime() - new Date(vehiculo.updatedAt).getTime()) / 86400000))
      : null;

    // ── ANÁLISIS DE REEMPLAZO (económico, determinístico) ──
    // Historial de costos 24m → tendencia + proyección 12m (regresión lineal).
    // Regla: si el mantenimiento proyectado supera el costo anual de capital de
    // una unidad nueva (valorAdquisicion / vidaUtilAnios), conviene reemplazar.
    // Variables configurables en /fleet-ops/config-reemplazo (defaults abajo).
    const cfg = {
      vidaUtilAnios: 10,
      depreciacionAnualPct: 10,
      umbralReemplazarPct: 100,
      umbralEvaluarPct: 60,
      tendenciaVigilarPct: 50,
      acumuladoVigilarPct: 70,
      ...((reemplazoCfg?.flotaReemplazoConfig as any) || {}),
    };
    const reemplazo = (() => {
      const edadAnios = vehiculo.anio ? now.getFullYear() - vehiculo.anio : null;
      const MESES = 24;
      const buckets = new Array<number>(MESES).fill(0);
      for (const wo of historialOTs) {
        if (!wo.completedAt) continue;
        const m = Math.floor((now.getTime() - new Date(wo.completedAt).getTime()) / (30.44 * 86400000));
        if (m >= 0 && m < MESES) buckets[MESES - 1 - m] += wo.totalCost || 0;
      }
      const costoAcumulado = historialOTs.reduce((a: number, w: any) => a + (w.totalCost || 0), 0);
      const ultimos6 = buckets.slice(-6).reduce((a, b) => a + b, 0);
      const previos6 = buckets.slice(-12, -6).reduce((a, b) => a + b, 0);
      const tendenciaPct = previos6 > 0 ? Math.round(((ultimos6 - previos6) / previos6) * 100) : (ultimos6 > 0 ? 100 : 0);
      const costoAnualUltimos12m = buckets.slice(-12).reduce((a, b) => a + b, 0);

      // Regresión lineal sobre buckets mensuales → proyección próximos 12 meses
      const n = MESES;
      const sumX = (n * (n - 1)) / 2;
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
      const sumY = buckets.reduce((a, b) => a + b, 0);
      const sumXY = buckets.reduce((a, y, x) => a + x * y, 0);
      const denom = n * sumX2 - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;
      let proyeccion12m = 0;
      for (let x = n; x < n + 12; x++) proyeccion12m += Math.max(0, intercept + slope * x);

      const valorResidual = vehiculo.valorAdquisicion && edadAnios != null
        ? Math.round(vehiculo.valorAdquisicion * Math.pow(1 - cfg.depreciacionAnualPct / 100, edadAnios))
        : null;
      const costoCapitalAnualNueva = vehiculo.valorAdquisicion ? vehiculo.valorAdquisicion / cfg.vidaUtilAnios : null;
      const ratioProyVsCapital = costoCapitalAnualNueva ? proyeccion12m / costoCapitalAnualNueva : null;
      const ratioAcumVsAdq = vehiculo.valorAdquisicion ? costoAcumulado / vehiculo.valorAdquisicion : null;

      const motivos: string[] = [];
      let recomendacion = 'MANTENER';
      if (ratioProyVsCapital != null && ratioProyVsCapital >= cfg.umbralReemplazarPct / 100) {
        recomendacion = 'REEMPLAZAR';
        motivos.push(`El mantenimiento proyectado a 12 meses ($${Math.round(proyeccion12m).toLocaleString('es-AR')}) supera el costo anual de una unidad nueva`);
      } else if (ratioProyVsCapital != null && ratioProyVsCapital >= cfg.umbralEvaluarPct / 100) {
        recomendacion = 'EVALUAR_REEMPLAZO';
        motivos.push(`El mantenimiento proyectado equivale al ${Math.round(ratioProyVsCapital * 100)}% del costo anual de una unidad nueva`);
      } else if (tendenciaPct > cfg.tendenciaVigilarPct) {
        recomendacion = 'VIGILAR';
        motivos.push(`El costo de mantenimiento creció ${tendenciaPct}% respecto al semestre anterior`);
      }
      if (ratioAcumVsAdq != null && ratioAcumVsAdq >= cfg.acumuladoVigilarPct / 100) {
        if (recomendacion === 'MANTENER') recomendacion = 'VIGILAR';
        motivos.push(`El gasto acumulado en reparaciones equivale al ${Math.round(ratioAcumVsAdq * 100)}% del valor de adquisición`);
      }
      if (edadAnios != null && edadAnios >= 10) motivos.push(`Unidad con ${edadAnios} años de antigüedad`);
      if (historialOTs.length < 3) motivos.push('Poco historial de costos — la recomendación mejora con más datos');
      if (vehiculo.valorAdquisicion == null) motivos.push('Sin valor de adquisición cargado — la comparación económica es limitada');

      // Meses estimados hasta que el costo mensual proyectado cruce el umbral
      let mesesEstimados: number | null = null;
      if (costoCapitalAnualNueva && slope > 0) {
        const umbralMensual = costoCapitalAnualNueva / 12;
        for (let x = n; x < n + 120; x++) {
          if (Math.max(0, intercept + slope * x) >= umbralMensual) { mesesEstimados = x - n + 1; break; }
        }
      }
      const kmMes = kmRecorridos6m && kmRecorridos6m > 0 ? kmRecorridos6m / 6 : null;
      const kmEstimados = mesesEstimados != null && kmMes ? Math.round(km + mesesEstimados * kmMes) : null;

      return {
        recomendacion, motivos,
        edadAnios, kmActual: km,
        costoAcumulado: Math.round(costoAcumulado),
        costoAnualUltimos12m: Math.round(costoAnualUltimos12m),
        tendenciaPct,
        proyeccion12m: Math.round(proyeccion12m),
        valorResidual,
        costoCapitalAnualNueva: costoCapitalAnualNueva ? Math.round(costoCapitalAnualNueva) : null,
        ratioProyVsCapital: ratioProyVsCapital != null ? Math.round(ratioProyVsCapital * 100) / 100 : null,
        mesesEstimadosReemplazo: mesesEstimados,
        kmEstimadosReemplazo: kmEstimados,
        kmPorMes: kmMes ? Math.round(kmMes) : null,
      };
    })();

    // Componentes específicos de semi: sin motor/combustible propio; agrega suspensión, ejes y acople
    // derivados de hallazgos QR recientes y estado de neumáticos (sin inventar métricas).
    let componentes: any = {
      motor: { salud: motorSalud, riesgo: 100 - motorSalud, kmRestantes: motorKmRestantes, label: 'Motor / Aceite' },
      frenos: { salud: frenosSalud, riesgo: 100 - frenosSalud, kmRestantes: frenosKmRestantes, label: 'Frenos' },
      neumaticos: { salud: neumSalud, riesgo: 100 - neumSalud, montados: neumaticos.length, bandaMinima: neumMinBanda, label: 'Neumáticos' },
      documentacion: { salud: docSalud, riesgo: 100 - docSalud, vencidos: docsVencidos.length, porVencer: docsPorVencer.length, label: 'Documentación' },
      combustible: { salud: combSalud, riesgo: 100 - combSalud, l100km, label: 'Eficiencia combustible' },
    };

    if (esSemi) {
      // Hallazgos QR recientes del semi como señal de suspensión/ejes/acople
      const hallazgosRecientes = ultimaInspeccion?.hallazgosCount ?? null;
      const baseSemi = hallazgosRecientes == null ? null : Math.max(10, 100 - hallazgosRecientes * 20);
      componentes = {
        frenos: componentes.frenos,
        suspension: { salud: baseSemi, riesgo: baseSemi != null ? 100 - baseSemi : null, label: 'Suspensión', sinDatos: baseSemi == null },
        ejes: { salud: baseSemi, riesgo: baseSemi != null ? 100 - baseSemi : null, label: 'Ejes', sinDatos: baseSemi == null },
        neumaticos: componentes.neumaticos,
        documentacion: componentes.documentacion,
        acople: { salud: baseSemi, riesgo: baseSemi != null ? 100 - baseSemi : null, label: 'Sistema de acople', sinDatos: baseSemi == null },
      };
    }

    return reply.send({
      twin: {
        vehiculoId: id,
        dominio: vehiculo.dominio,
        tipo: vehiculo.tipo,
        esSemi,
        healthScore,
        riskScore,
        estadoGeneral,
        estadoOperativo: vehiculo.status,
        odometro: vehiculo.currentOdometer,
        componentes,
        alertas,
        prediccion: {
          proximoServicioKm: motorKmRestantes,
          proximoServicioDias: diasProxServicio,
          kmActuales: km,
        },
        proximoServicio,
        ultimaInspeccion,
        costoPorKm,
        costos6m: Math.round(costos6m),
        diasEnTaller,
        otAbiertas: workOrders.filter((wo: any) => !['COMPLETED','CANCELLED'].includes(wo.status)).length,
        reemplazo,
        calculadoEn: now.toISOString(),
      }
    });
  });

  // GET /vehiculos/:id/proyeccion?km=N&meses=M&kmMes=X&escenario=con|sin&perfil=RUTA
  // Gemelo digital: proyección por vehículo y componente con 3 métricas
  // diferenciadas (intervalo de mantenimiento / referencia de vida en servicio /
  // condición medida). Nunca presenta odómetro÷constante como "salud".
  app.get('/vehiculos/:id/proyeccion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const q = req.query as any;
    const kmProyectar = Math.min(Math.max(Number(q.km) || 0, 0), 500000);
    const mesesProyectar = q.meses != null ? Math.min(Math.max(Number(q.meses) || 0, 0), 120) : null;
    const kmMesHipotesis = q.kmMes != null ? Math.min(Math.max(Number(q.kmMes) || 0, 0), 50000) : null;
    const escenario = q.escenario === 'sin' ? 'SIN_MANTENIMIENTO' : 'CON_MANTENIMIENTO';
    const perfil = q.perfil || null;
    if (!kmProyectar && !mesesProyectar) return reply.code(400).send({ error: 'Indicá km y/o meses a proyectar' });

    const proyeccion = await proyectarVehiculo(app.prisma as any, tenantId, id, {
      kmProyectar: kmProyectar || Math.round((mesesProyectar || 0) * (kmMesHipotesis || 0)),
      mesesProyectar, kmMesHipotesis, escenario, perfil,
    });
    if (!proyeccion) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ proyeccion });
  });

  // ── Catálogo técnico de referencias por componente ──
  app.get('/referencias-componentes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    // Auto-seed del catálogo global si está vacío (idempotente)
    const count = await (app.prisma as any).fleetComponentReference.count({ where: { tenantId: null } }).catch(() => 0);
    if (count === 0) {
      const { FLEET_COMPONENT_REFS_SEED } = await import('../data/fleetComponentRefs.js');
      for (const r of FLEET_COMPONENT_REFS_SEED) {
        await (app.prisma as any).fleetComponentReference.create({ data: { ...r, tenantId: null } }).catch(() => {});
      }
    }
    const referencias = await (app.prisma as any).fleetComponentReference.findMany({
      where: { isActive: true, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: [{ componentKey: 'asc' }, { version: 'desc' }],
    });
    return reply.send({ referencias });
  });

  app.post('/referencias-componentes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const b = req.body as any;
    if (!b.componentKey || !b.componentLabel || !b.tipoMetrica) return reply.code(400).send({ error: 'componentKey, componentLabel y tipoMetrica requeridos' });
    const ref = await (app.prisma as any).fleetComponentReference.create({
      data: {
        tenantId, componentKey: b.componentKey, componentLabel: b.componentLabel,
        sistema: b.sistema || 'GENERAL', tipoMetrica: b.tipoMetrica,
        marcaVehiculo: b.marcaVehiculo, modeloVehiculo: b.modeloVehiculo, motor: b.motor, caja: b.caja,
        regimenUso: b.regimenUso, tarea: b.tarea,
        intervaloKm: b.intervaloKm, intervaloHoras: b.intervaloHoras, intervaloMeses: b.intervaloMeses,
        rangoMinKm: b.rangoMinKm, rangoMaxKm: b.rangoMaxKm, rangoMinMeses: b.rangoMinMeses, rangoMaxMeses: b.rangoMaxMeses,
        unidad: b.unidad || 'km', fuente: b.fuente, documentoSeccion: b.documentoSeccion, fuenteUrl: b.fuenteUrl,
        fechaRevision: b.fechaRevision ? new Date(b.fechaRevision) : null, aprobadoPor: b.aprobadoPor,
        estado: b.estado || 'PROVISIONAL', notas: b.notas, matchRegex: b.matchRegex,
      },
    });
    return reply.code(201).send({ referencia: ref });
  });

  app.patch('/referencias-componentes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const b = req.body as any;
    const existente = await (app.prisma as any).fleetComponentReference.findFirst({ where: { id, OR: [{ tenantId }, { tenantId: null }] } });
    if (!existente) return reply.code(404).send({ error: 'No encontrada' });
    // Nueva versión si cambian valores numéricos (preserva proyecciones anteriores)
    const cambiaValores = ['intervaloKm','intervaloMeses','intervaloHoras','rangoMinKm','rangoMaxKm'].some(k => b[k] !== undefined && b[k] !== existente[k]);
    const ref = await (app.prisma as any).fleetComponentReference.update({
      where: { id },
      data: { ...b, version: cambiaValores ? existente.version + 1 : existente.version, supersedesId: cambiaValores ? existente.id : existente.supersedesId },
    });
    return reply.send({ referencia: ref });
  });

  // ── Mediciones de condición por componente ──
  app.post('/vehiculos/:id/mediciones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const b = req.body as any;
    if (!b.componentKey || !b.tipo) return reply.code(400).send({ error: 'componentKey y tipo requeridos' });
    const med = await (app.prisma as any).fleetComponentMeasurement.create({
      data: {
        tenantId, vehiculoId: id, componentKey: b.componentKey, instanceId: b.instanceId || null,
        tipo: b.tipo, valor: b.valor ?? null, valorTexto: b.valorTexto || null, unidad: b.unidad || null,
        kmAlMedir: b.kmAlMedir ?? null, fecha: b.fecha ? new Date(b.fecha) : new Date(),
        workOrderId: b.workOrderId || null, registradoPor: (req as any).auth?.userId || null, notas: b.notas || null,
      },
    });
    return reply.code(201).send({ medicion: med });
  });

  // ── Origen del componente instalado (original/reemplazo/desconocido) ──
  app.patch('/instalaciones/:id/origen', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const b = req.body as any;
    const inst = await (app.prisma as any).fleetComponentInstallation.findFirst({ where: { id, tenantId } });
    if (!inst) return reply.code(404).send({ error: 'No encontrada' });
    const upd = await (app.prisma as any).fleetComponentInstallation.update({
      where: { id },
      data: { origen: b.origen || inst.origen, origenNotas: b.origenNotas ?? inst.origenNotas, installedKm: b.installedKm ?? inst.installedKm, installedAt: b.installedAt ? new Date(b.installedAt) : inst.installedAt },
    });
    return reply.send({ instalacion: upd });
  });

  // ── Perfil de uso y ritmo declarado del vehículo ──
  app.put('/vehiculos/:id/perfil-uso', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const b = req.body as any;
    const upd = await (app.prisma as any).vehiculo.update({
      where: { id },
      data: { perfilUso: b.perfilUso ?? undefined, kmMesEstimado: b.kmMesEstimado ?? undefined },
    });
    return reply.send({ vehiculo: { id: upd.id, perfilUso: upd.perfilUso, kmMesEstimado: upd.kmMesEstimado } });
  });

  app.get('/vehiculos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId },
      include: {
        conductor: { select: { id: true, nombre: true, categoria: true } },
        vencimientos: { orderBy: { fechaVto: 'asc' } },
        posicionesNeumatico: { where: { activo: true }, include: { neumatico: true }, orderBy: [{ eje: 'asc' }, { lado: 'asc' }] },
        _count: { select: { registrosCombustible: true } },
      },
      orderBy: { dominio: 'asc' },
    });
    return reply.send({ vehiculos });
  });

  // GET vehículo completo con datos unificados de mantenimiento
  app.get('/vehiculos/:id/completo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id, tenantId },
      include: {
        conductor: true,
        vencimientos: { orderBy: { fechaVto: 'asc' } },
        posicionesNeumatico: { where: { activo: true }, include: { neumatico: true } },
        historialMantenimiento: { orderBy: { fecha: 'desc' }, take: 10 },
        garantias: { where: { status: 'ACTIVA' } },
        _count: { select: { registrosCombustible: true } },
      }
    });

    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Datos del activo de mantenimiento vinculado
    let maintenanceAsset = null;
    let digitalTwin = null;
    let workOrders = [];
    let maintenancePlans = [];
    let predictions = [];

    if (vehiculo.maintenanceAssetId) {
      maintenanceAsset = await (app.prisma as any).maintenanceAsset.findFirst({
        where: { id: vehiculo.maintenanceAssetId, tenantId },
        select: {
          id: true, code: true, name: true, status: true,
          totalMaintenanceCost: true, lastMaintenanceDate: true, nextMaintenanceDate: true,
          currentOdometer: true, purchaseDate: true, acquisitionCost: true, manufacturer: true,
        }
      });

      if (maintenanceAsset) {
        digitalTwin = await (app.prisma as any).assetDigitalTwin.findUnique({
          where: { assetId_tenantId: { assetId: maintenanceAsset.id, tenantId } },
          include: {
            predictions: {
              where: { validadoAt: null, workOrderId: null },
              orderBy: { probabilidad: 'desc' },
              take: 5,
            }
          }
        }).catch(() => null);

        workOrders = await (app.prisma as any).workOrder.findMany({
          where: { assetId: maintenanceAsset.id, tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, code: true, title: true, status: true, priority: true,
            type: true, scheduledDate: true, completedAt: true, totalCost: true,
          }
        });

        maintenancePlans = await (app.prisma as any).maintenancePlan.findMany({
          where: { assetId: maintenanceAsset.id, tenantId, status: 'ACTIVE' },
          select: {
            id: true, title: true, frequencyUnit: true, frequencyValue: true,
            triggerKm: true, nextExecutionDate: true, lastExecutionDate: true,
          }
        });

        predictions = digitalTwin?.predictions || [];
      }
    }

    // KPIs calculados
    const otsPendientes = workOrders.filter((ot: any) => ['PENDING', 'IN_PROGRESS'].includes(ot.status)).length;
    const otsCompletadas = workOrders.filter((ot: any) => ot.status === 'COMPLETED').length;
    const costoTotalMantenimiento = workOrders.reduce((sum: number, ot: any) => sum + (ot.totalCost || 0), 0);
    const planesPorKm = maintenancePlans.filter((p: any) => p.frequencyUnit === 'KM');
    const planesPorTiempo = maintenancePlans.filter((p: any) => ['DAYS', 'WEEKS', 'MONTHS'].includes(p.frequencyUnit));

    return reply.send({
      vehiculo,
      mantenimiento: {
        asset: maintenanceAsset,
        digitalTwin,
        workOrders,
        maintenancePlans,
        predictions,
        kpis: {
          otsPendientes,
          otsCompletadas,
          otsTotal: workOrders.length,
          costoTotalMantenimiento,
          planesActivos: maintenancePlans.length,
          planesPorKm: planesPorKm.length,
          planesPorTiempo: planesPorTiempo.length,
          prediccionesActivas: predictions.length,
          ultimaFechaMantenimiento: maintenanceAsset?.lastMaintenanceDate,
          proximaFechaMantenimiento: maintenanceAsset?.nextMaintenanceDate,
        }
      },
      alertas: {
        vencimientosProximos: vehiculo.vencimientos?.filter((v: any) => {
          const dias = Math.ceil((new Date(v.fechaVto).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return dias <= 30 && dias >= 0;
        }).length || 0,
        prediccionesCriticas: predictions.filter((p: any) => p.severidad === 'CRITICA').length,
        prediccionesAltas: predictions.filter((p: any) => p.severidad === 'ALTA').length,
        otsVencidas: workOrders.filter((ot: any) => ot.status === 'PENDING' && ot.scheduledDate && new Date(ot.scheduledDate) < new Date()).length,
      }
    });
  });

  app.post('/vehiculos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      dominio: z.string().min(1).max(20).transform(v => v.toUpperCase()),
      tipo: z.string().default('CAMION'),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      anio: z.number().int().optional(),
      color: z.string().optional(),
      chasis: z.string().optional(),
      motor: z.string().optional(),
      status: z.string().optional().default('ACTIVO'),
      currentOdometer: z.number().optional(),
      valorAdquisicion: z.number().optional().nullable(),
      conductorId: z.string().uuid().optional().nullable(),
      maintenanceAssetId: z.string().uuid().optional().nullable(),
      notas: z.string().optional(),
      // Campos adicionales para crear el activo de mantenimiento automáticamente
      crearActivoMantenimiento: z.boolean().default(true),
      acquisitionCost: z.number().optional(),
      manufacturer: z.string().optional(),
      purchaseDate: z.string().datetime().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const { crearActivoMantenimiento, acquisitionCost, manufacturer, purchaseDate, ...vehiculoData } = body.data;

    // Verificar dominio duplicado para este tenant
    const dominioExistente = await (app.prisma as any).vehiculo.findFirst({
      where: { tenantId, dominio: vehiculoData.dominio }
    });
    if (dominioExistente) {
      return reply.code(409).send({ error: `Ya existe un vehículo con el dominio "${vehiculoData.dominio}" en tu flota.` });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREAR VEHÍCULO + ACTIVO EN UNA SOLA TRANSACCIÓN
    // ═══════════════════════════════════════════════════════════════
    let maintenanceAsset: any = null;
    let vehiculo: any;

    const txResult = await (app.prisma as any).$transaction(async (tx: any) => {
      const v = await tx.vehiculo.create({
        data: { ...vehiculoData, tenantId, maintenanceAssetId: null }
      });

      let asset = null;
      if (crearActivoMantenimiento && !vehiculoData.maintenanceAssetId) {
        const assetCode = `V-${v.dominio}`;
        const assetName = `${v.marca || ''} ${v.modelo || ''} ${v.dominio}`.trim();

        // Si ya existe un activo con este código, lo reutilizamos en vez de fallar
        const existing = await tx.maintenanceAsset.findFirst({ where: { code: assetCode } });
        if (existing) {
          asset = existing;
        } else {
          asset = await tx.maintenanceAsset.create({
            data: {
              tenantId,
              code: assetCode,
              name: assetName || v.dominio,
              description: `Vehículo de flota: ${v.dominio}. Tipo: ${v.tipo}. Creado automáticamente desde Flota 360.`,
              category: 'VEHICLE',
              status: 'ACTIVE',
              manufacturer: manufacturer || v.marca || 'Sin especificar',
              model: v.modelo || 'Sin especificar',
              serialNumber: v.chasis || v.motor || undefined,
              acquisitionCost: acquisitionCost || vehiculoData.valorAdquisicion || 0,
              purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
              currentOdometer: v.currentOdometer,
              location: 'Flota',
            }
          });
        }

        const updated = await tx.vehiculo.update({
          where: { id: v.id },
          data: { maintenanceAssetId: asset.id }
        });
        return { vehiculo: updated, maintenanceAsset: asset };
      }

      return { vehiculo: v, maintenanceAsset: null };
    });

    vehiculo = txResult.vehiculo;
    maintenanceAsset = txResult.maintenanceAsset;

    // Crear Digital Twin fuera de la transacción (best-effort)
    if (maintenanceAsset) {
      try {
        await (app.prisma as any).assetDigitalTwin.create({
          data: {
            tenantId,
            assetId: maintenanceAsset.id,
            healthScore: 100,
            riskScore: 0,
            componentes: JSON.stringify({
              motor: { salud: 100, riesgo: 0, kmRestantes: 100000 },
              frenos: { salud: 100, riesgo: 0, kmRestantes: 50000 },
              caja: { salud: 100, riesgo: 0, kmRestantes: 80000 },
              diferencial: { salud: 100, riesgo: 0, kmRestantes: 70000 },
              neumaticos: { salud: 100, riesgo: 0, kmRestantes: 40000 },
            }),
            syncSource: 'AUTO',
          }
        });
      } catch { /* tabla no existe en esta BD */ }
    }

    return reply.code(201).send({
      vehiculo,
      maintenanceAsset,
      mensaje: maintenanceAsset
        ? 'Vehículo creado con activo de mantenimiento vinculado automáticamente'
        : 'Vehículo creado sin activo de mantenimiento'
    });
  });

  app.patch('/vehiculos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      dominio: z.string().optional().transform(v => v ? v.toUpperCase() : v),
      tipo: z.string().optional(),
      cantEjes: z.number().int().min(1).max(10).optional(),
      configEjes: z.string().optional(),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      anio: z.number().int().optional(),
      color: z.string().optional(),
      chasis: z.string().optional(),
      motor: z.string().optional(),
      status: z.string().optional(),
      conductorId: z.string().uuid().optional().nullable(),
      maintenanceAssetId: z.string().uuid().optional().nullable(),
      currentOdometer: z.number().optional(),
      valorAdquisicion: z.number().optional().nullable(),
      notas: z.string().optional(),
    }).passthrough();
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // ═══════════════════════════════════════════════════════════════
    // SINCRONIZAR ODÓMETRO CON ACTIVO DE MANTENIMIENTO
    // ═══════════════════════════════════════════════════════════════
    if (body.data.currentOdometer !== undefined) {
      const vehiculo = await (app.prisma as any).vehiculo.findFirst({
        where: { id, tenantId },
        select: { maintenanceAssetId: true }
      });
      if (vehiculo?.maintenanceAssetId) {
        await (app.prisma as any).maintenanceAsset.updateMany({
          where: { id: vehiculo.maintenanceAssetId, tenantId },
          data: { currentOdometer: body.data.currentOdometer }
        });
      }
    }

    const { conductorId, crearActivoMantenimiento, acquisitionCost, manufacturer, purchaseDate, maintenanceAssetId, ...vehiculoFields } = body.data as any;
    const updateData: any = { ...vehiculoFields };
    if (maintenanceAssetId !== undefined) updateData.maintenanceAssetId = maintenanceAssetId;
    await (app.prisma as any).vehiculo.updateMany({ where: { id, tenantId }, data: updateData });

    // Sincronizar datos de adquisición al activo de mantenimiento vinculado
    const valorAdq = (body.data as any).valorAdquisicion;
    if (acquisitionCost !== undefined || purchaseDate !== undefined || manufacturer !== undefined || valorAdq !== undefined) {
      const veh = await (app.prisma as any).vehiculo.findFirst({ where: { id, tenantId }, select: { maintenanceAssetId: true } });
      const assetId = maintenanceAssetId !== undefined ? maintenanceAssetId : veh?.maintenanceAssetId;
      if (assetId) {
        const assetData: any = {};
        const costo = acquisitionCost !== undefined ? acquisitionCost : valorAdq;
        if (costo !== undefined) assetData.acquisitionCost = Number(costo) || 0;
        if (purchaseDate !== undefined) assetData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
        if (manufacturer !== undefined) assetData.manufacturer = manufacturer;
        await (app.prisma as any).maintenanceAsset.updateMany({ where: { id: assetId, tenantId }, data: assetData });
      }
    }
    // conductorId no está en el cliente Prisma compilado en prod → raw SQL
    if (conductorId !== undefined) {
      if (conductorId === null) {
        await (app.prisma as any).$executeRaw`UPDATE flota_vehiculos SET "conductorId" = NULL WHERE id = ${id}::uuid AND "tenantId" = ${tenantId}::uuid`;
      } else {
        await (app.prisma as any).$executeRawUnsafe(`UPDATE flota_vehiculos SET "conductorId" = '${conductorId}'::uuid WHERE id = '${id}'::uuid AND "tenantId" = '${tenantId}'::uuid`);
      }
    }
    return reply.send({ ok: true });
  });

  // DELETE /vehiculos/:id - Marcar como BAJA (eliminación lógica)
  app.delete('/vehiculos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    
    await (app.prisma as any).vehiculo.updateMany({ 
      where: { id, tenantId }, 
      data: { status: 'BAJA' } 
    });
    
    return reply.send({ ok: true, mensaje: 'Vehículo marcado como BAJA' });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONDUCTORES
  // ═══════════════════════════════════════════════════════════════

  app.get('/conductores', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const conductores = await (app.prisma as any).conductor.findMany({
      where: { tenantId },
      include: { vehiculos: { select: { id: true, dominio: true, tipo: true, status: true } } },
      orderBy: { nombre: 'asc' },
    });
    return reply.send({ conductores });
  });

  app.post('/conductores', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      nombre: z.string().min(1),
      dni: z.string().optional(),
      telefono: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
      categoria: z.string().optional(),
      nroLicencia: z.string().optional(),
      licenciaVto: z.string().optional(),
      psicofisicoVto: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const { licenciaVto, psicofisicoVto, ...rest } = body.data;
    const conductor = await (app.prisma as any).conductor.create({
      data: {
        ...rest,
        tenantId,
        licenciaVto: licenciaVto ? new Date(licenciaVto) : null,
        psicofisicoVto: psicofisicoVto ? new Date(psicofisicoVto) : null,
      },
    });
    return reply.code(201).send({ conductor });
  });

  app.patch('/conductores/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const data = req.body as any;
    if (data.licenciaVto) data.licenciaVto = new Date(data.licenciaVto);
    if (data.psicofisicoVto) data.psicofisicoVto = new Date(data.psicofisicoVto);
    await (app.prisma as any).conductor.updateMany({ where: { id, tenantId }, data });
    return reply.send({ ok: true });
  });

  app.delete('/conductores/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    // Desasociar vehículos antes de eliminar para evitar FK violation
    await (app.prisma as any).vehiculo.updateMany({ where: { conductorId: id, tenantId }, data: { conductorId: null } });
    await (app.prisma as any).conductor.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // VENCIMIENTOS
  // ═══════════════════════════════════════════════════════════════

  app.get('/vencimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const vencimientos = await (app.prisma as any).vencimientoDocumento.findMany({
      where: { tenantId, renovado: false },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true, marca: true, modelo: true } } },
      orderBy: { fechaVto: 'asc' },
    });
    return reply.send({ vencimientos });
  });

  app.post('/vehiculos/:vehiculoId/vencimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const schema = z.object({
      tipo: z.string().min(1),
      descripcion: z.string().optional(),
      fechaVto: z.string().min(1),
      alertaDias: z.number().int().default(30),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const vencimiento = await (app.prisma as any).vencimientoDocumento.create({
      data: { ...body.data, vehiculoId, tenantId, fechaVto: new Date(body.data.fechaVto) },
    });
    return reply.code(201).send({ vencimiento });
  });

  app.patch('/vencimientos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const data = req.body as any;
    if (data.fechaVto) data.fechaVto = new Date(data.fechaVto);
    await (app.prisma as any).vencimientoDocumento.updateMany({ where: { id, tenantId }, data });
    return reply.send({ ok: true });
  });

  app.delete('/vencimientos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).vencimientoDocumento.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // NEUMÁTICOS
  // ═══════════════════════════════════════════════════════════════

  app.get('/neumaticos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const neumaticos = await (app.prisma as any).neumatico.findMany({
      where: { tenantId },
      include: {
        posiciones: {
          where: { activo: true },
          include: { vehiculo: { select: { id: true, dominio: true, tipo: true, currentOdometer: true } } },
        },
      },
      orderBy: { codigo: 'asc' },
    });
    // Enrich with sparePart name if linked
    const sparePartIds = neumaticos.filter((n: any) => n.sparePartId).map((n: any) => n.sparePartId);
    let spareParts: any[] = [];
    if (sparePartIds.length > 0) {
      spareParts = await (app.prisma as any).maintenanceSparePart.findMany({
        where: { id: { in: sparePartIds } },
        select: { id: true, code: true, name: true, currentStock: true, unitCost: true, medida: true },
      });
    }
    const spMap = Object.fromEntries(spareParts.map((s: any) => [s.id, s]));
    const enriched = neumaticos.map((n: any) => ({ ...n, sparePart: n.sparePartId ? spMap[n.sparePartId] || null : null }));
    return reply.send({ neumaticos: enriched });
  });

  // GET repuestos categoria neumatico para selector
  app.get('/neumaticos/repuestos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const parts = await (app.prisma as any).maintenanceSparePart.findMany({
      where: { tenantId },
      select: { id: true, code: true, name: true, currentStock: true, unitCost: true },
      orderBy: { name: 'asc' },
    });
    return reply.send({ parts });
  });

  app.post('/neumaticos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      codigo: z.string().min(1),
      marca: z.string().optional(),
      modelo: z.string().optional(),
      medida: z.string().optional(),
      dot: z.string().optional(),
      condicion: z.enum(['NUEVA', 'USADA', 'RECAPADA']).optional().default('NUEVA'),
      profBanda: z.number().optional(),
      sparePartId: z.string().uuid().optional().nullable(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const neumatico = await (app.prisma as any).neumatico.create({ data: { ...body.data, tenantId } });
    return reply.code(201).send({ neumatico });
  });

  app.patch('/neumaticos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).neumatico.updateMany({ where: { id, tenantId }, data: req.body as any });
    return reply.send({ ok: true });
  });

  // Eliminar neumático (solo si está DISPONIBLE, no montado)
  app.delete('/neumaticos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id, tenantId } });
    if (!neum) return reply.code(404).send({ error: 'Neumático no encontrado' });
    if (neum.status !== 'DISPONIBLE') return reply.code(400).send({ error: 'No se puede eliminar: el neumático está EN_USO o DESCARTADO' });
    // Eliminar posiciones históricas primero
    await (app.prisma as any).neumaticoPosicion.deleteMany({ where: { neumaticoId: id, tenantId } });
    await (app.prisma as any).neumatico.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // Montar neumático en vehículo — descuenta stock del repuesto vinculado
  app.post('/neumaticos/:neumaticoId/montar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      vehiculoId: z.string().uuid(),
      eje: z.number().int().min(0), // 0 = auxilio
      lado: z.enum(['IZQ', 'DER']),
      posicion: z.enum(['SIMPLE', 'EXT', 'INT', 'AUXILIO']).default('SIMPLE'),
      kmAlMontar: z.number().optional(),
      profBandaInicio: z.number().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Desmontar posición previa si existía
    await (app.prisma as any).neumaticoPosicion.updateMany({
      where: { neumaticoId, activo: true, tenantId },
      data: { activo: false, desmontadoAt: new Date(), kmAlDesmontar: body.data.kmAlMontar },
    });

    // Si no se pasó kmAlMontar, tomarlo del odómetro actual del vehículo
    let kmAlMontar = body.data.kmAlMontar;
    if (kmAlMontar == null) {
      const veh = await (app.prisma as any).vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId }, select: { currentOdometer: true } });
      if (veh?.currentOdometer) kmAlMontar = veh.currentOdometer;
    }

    const posicion = await (app.prisma as any).neumaticoPosicion.create({
      data: { ...body.data, kmAlMontar, neumaticoId, tenantId, activo: true },
    });

    // Actualizar estado del neumático
    await (app.prisma as any).neumatico.updateMany({ where: { id: neumaticoId }, data: { status: 'EN_USO' } });

    // Descontar 1 unidad del stock del repuesto vinculado
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: neumaticoId }, select: { sparePartId: true } });
    if (neum?.sparePartId) {
      await (app.prisma as any).maintenanceSparePart.updateMany({
        where: { id: neum.sparePartId, tenantId, currentStock: { gt: 0 } },
        data: { currentStock: { decrement: 1 } },
      });
    }

    return reply.code(201).send({ posicion });
  });

  // Desmontar neumático — calcula km recorridos y actualiza acumulado
  app.post('/neumaticos/:neumaticoId/desmontar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const { kmAlDesmontar, profBandaFin } = req.body as any;

    // Buscar posición activa para calcular km recorridos
    const posActiva = await (app.prisma as any).neumaticoPosicion.findFirst({
      where: { neumaticoId, activo: true, tenantId },
      select: { kmAlMontar: true },
    });

    await (app.prisma as any).neumaticoPosicion.updateMany({
      where: { neumaticoId, activo: true, tenantId },
      data: { activo: false, desmontadoAt: new Date(), kmAlDesmontar: kmAlDesmontar || null, profBandaFin: profBandaFin || null },
    });

    // Acumular km recorridos en el neumático
    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: neumaticoId }, select: { kmAcumulados: true } });
    const kmRecorridos = (posActiva?.kmAlMontar != null && kmAlDesmontar) ? (kmAlDesmontar - posActiva.kmAlMontar) : 0;
    const updateData: any = { status: 'DISPONIBLE' };
    if (profBandaFin != null) updateData.profBanda = profBandaFin;
    if (kmRecorridos > 0) updateData.kmAcumulados = (neum?.kmAcumulados || 0) + kmRecorridos;
    await (app.prisma as any).neumatico.updateMany({ where: { id: neumaticoId }, data: updateData });
    return reply.send({ ok: true, kmRecorridos: Math.max(0, kmRecorridos) });
  });

  // Historial de posiciones de un neumático
  app.get('/neumaticos/:id/historial', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const historial = await (app.prisma as any).neumaticoPosicion.findMany({
      where: { neumaticoId: id, tenantId },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { montadoAt: 'desc' },
    });
    return reply.send({ historial });
  });

  // GET diagrama de ejes de un vehículo: neumáticos montados por posición
  app.get('/vehiculos/:id/diagrama', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const vehiculo = await (app.prisma as any).vehiculo.findFirst({ where: { id, tenantId } });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    const posiciones = await (app.prisma as any).neumaticoPosicion.findMany({
      where: { vehiculoId: id, tenantId, activo: true },
      include: { neumatico: { select: { id: true, codigo: true, marca: true, medida: true, profBanda: true, kmAcumulados: true, status: true, presionRecomendada: true, funcion: true } } },
      orderBy: [{ eje: 'asc' }, { lado: 'asc' }],
    });
    // Última presión por posición
    const presionesUltimas = await (app.prisma as any).neumaticoPresion.findMany({
      where: { vehiculoId: id, tenantId },
      orderBy: { fecha: 'desc' },
    });
    const presMap: any = {};
    for (const p of presionesUltimas) {
      const key = `${p.eje}-${p.lado}-${p.posicion}`;
      if (!presMap[key]) presMap[key] = p;
    }
    const posicionesEnriquecidas = posiciones.map((p: any) => ({
      ...p,
      ultimaPresion: presMap[`${p.eje}-${p.lado}-${p.posicion}`] || null,
    }));
    return reply.send({ vehiculo, posiciones: posicionesEnriquecidas });
  });

  // GET CPK (costo por kilómetro) de un neumático
  app.get('/neumaticos/:id/cpk', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const n = await (app.prisma as any).neumatico.findFirst({
      where: { id, tenantId },
      include: { recaps: true },
    });
    if (!n) return reply.code(404).send({ error: 'No encontrado' });
    const costoRecaps = (n.recaps || []).reduce((s: number, r: any) => s + (r.costo || 0), 0);
    const costoTotal = (n.precioCompra || 0) + costoRecaps;
    const cpk = n.kmAcumulados > 0 ? costoTotal / n.kmAcumulados : null;
    return reply.send({ cpk, costoTotal, costoRecaps, kmAcumulados: n.kmAcumulados });
  });

  // POST rotación: mueve un neumático de posición en el mismo vehículo
  app.post('/neumaticos/:neumaticoId/rotar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      ejeDestino: z.number().int().min(1),
      ladoDestino: z.enum(['IZQ', 'DER']),
      posDestino: z.enum(['SIMPLE', 'EXT', 'INT']).default('SIMPLE'),
      kmAlRotar: z.number().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const posActiva = await (app.prisma as any).neumaticoPosicion.findFirst({
      where: { neumaticoId, activo: true, tenantId },
    });
    if (!posActiva) return reply.code(400).send({ error: 'Neumático no montado' });
    // Registrar rotación
    await (app.prisma as any).neumaticoRotacion.create({
      data: {
        tenantId, neumaticoId,
        vehiculoId: posActiva.vehiculoId,
        ejeOrigen: posActiva.eje, ladoOrigen: posActiva.lado, posOrigen: posActiva.posicion,
        ejeDestino: body.data.ejeDestino, ladoDestino: body.data.ladoDestino, posDestino: body.data.posDestino,
        kmAlRotar: body.data.kmAlRotar, notas: body.data.notas,
      },
    });
    // Actualizar posición activa
    await (app.prisma as any).neumaticoPosicion.updateMany({
      where: { neumaticoId, activo: true, tenantId },
      data: { eje: body.data.ejeDestino, lado: body.data.ladoDestino, posicion: body.data.posDestino },
    });
    return reply.send({ ok: true });
  });

  // GET rotaciones de un neumático
  app.get('/neumaticos/:id/rotaciones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const rotaciones = await (app.prisma as any).neumaticoRotacion.findMany({
      where: { neumaticoId: id, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ rotaciones });
  });

  // POST presión
  app.post('/neumaticos/:neumaticoId/presion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      vehiculoId: z.string().uuid(),
      eje: z.number().int().min(0),
      lado: z.enum(['IZQ', 'DER']),
      posicion: z.enum(['SIMPLE', 'EXT', 'INT', 'AUXILIO']).default('SIMPLE'),
      presionMedida: z.number().positive(),
      temperatura: z.number().optional(),
      observador: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const presion = await (app.prisma as any).neumaticoPresion.create({
      data: { ...body.data, neumaticoId, tenantId },
    });
    return reply.code(201).send({ presion });
  });

  // GET historial de presiones de un neumático
  app.get('/neumaticos/:id/presiones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const presiones = await (app.prisma as any).neumaticoPresion.findMany({
      where: { neumaticoId: id, tenantId },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
    return reply.send({ presiones });
  });

  // POST daño en neumático
  app.post('/neumaticos/:neumaticoId/danio', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      tipo: z.enum(['CORTE', 'BURBUJA', 'DESGASTE_IRREGULAR', 'SEPARACION', 'IMPACTO', 'OTRO']),
      severidad: z.enum(['LEVE', 'GRAVE', 'INMEDIATO']).default('LEVE'),
      descripcion: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const danio = await (app.prisma as any).neumaticoDanio.create({
      data: { ...body.data, neumaticoId, tenantId },
    });
    return reply.code(201).send({ danio });
  });

  // PATCH daño (actualizar estado)
  app.patch('/neumaticos/danio/:danioId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { danioId } = req.params as any;
    const { estado } = req.body as any;
    await (app.prisma as any).neumaticoDanio.updateMany({ where: { id: danioId, tenantId }, data: { estado } });
    return reply.send({ ok: true });
  });

  // GET daños de un neumático
  app.get('/neumaticos/:id/danios', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const danios = await (app.prisma as any).neumaticoDanio.findMany({
      where: { neumaticoId: id, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ danios });
  });

  // POST recap
  app.post('/neumaticos/:neumaticoId/recap', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      proveedor: z.string().optional(),
      fecha: z.string().optional(),
      costo: z.number().optional(),
      profBandaPost: z.number().optional(),
      garantiaKm: z.number().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const recap = await (app.prisma as any).neumaticoRecap.create({
      data: {
        ...body.data,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        neumaticoId,
        tenantId,
      },
    });
    await (app.prisma as any).neumatico.updateMany({
      where: { id: neumaticoId },
      data: {
        condicion: 'RECAPADA',
        recapsCount: { increment: 1 },
        ...(body.data.profBandaPost != null ? { profBanda: body.data.profBandaPost } : {}),
      },
    });
    return reply.code(201).send({ recap });
  });

  // GET recaps de un neumático
  app.get('/neumaticos/:id/recaps', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const recaps = await (app.prisma as any).neumaticoRecap.findMany({
      where: { neumaticoId: id, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ recaps });
  });

  // ═══════════════════════════════════════════════════════════════
  // MEDICIONES DE BANDA (desgaste periódico sin desmontar)
  // ═══════════════════════════════════════════════════════════════

  // POST medición de profundidad de banda — actualiza profBanda del neumático
  app.post('/neumaticos/:neumaticoId/medicion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { neumaticoId } = req.params as any;
    const schema = z.object({
      profBanda: z.number().positive().max(30),
      kmAlMedir: z.number().nonnegative().optional(),
      presion: z.number().positive().optional(),
      vehiculoId: z.string().uuid().optional(),
      eje: z.number().int().min(1).optional(),
      lado: z.enum(['IZQ', 'DER']).optional(),
      posicion: z.enum(['SIMPLE', 'EXT', 'INT', 'AUXILIO']).optional(),
      observador: z.string().max(200).optional(),
      notas: z.string().max(500).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: neumaticoId, tenantId } });
    if (!neum) return reply.code(404).send({ error: 'Neumático no encontrado' });

    const medicion = await (app.prisma as any).neumaticoMedicion.create({
      data: { ...body.data, neumaticoId, tenantId },
    });

    // Actualizar profBanda actual del neumático + setear original si no tiene
    const upd: any = { profBanda: body.data.profBanda };
    if (neum.profBandaOriginal == null) upd.profBandaOriginal = neum.profBanda ?? body.data.profBanda;
    await (app.prisma as any).neumatico.updateMany({ where: { id: neumaticoId }, data: upd });

    // Si también midió presión, registrarla en el historial de presiones
    if (body.data.presion != null && body.data.vehiculoId && body.data.eje && body.data.lado) {
      await (app.prisma as any).neumaticoPresion.create({
        data: {
          tenantId, neumaticoId,
          vehiculoId: body.data.vehiculoId, eje: body.data.eje, lado: body.data.lado,
          posicion: body.data.posicion === 'AUXILIO' ? 'SIMPLE' : (body.data.posicion || 'SIMPLE'),
          presionMedida: body.data.presion, observador: body.data.observador, notas: body.data.notas,
        },
      }).catch(() => {});
    }

    // Notificar a admins si la banda está baja (≤2.5mm) o crítica (≤1.6mm)
    if (body.data.profBanda <= 2.5) {
      const veh = body.data.vehiculoId
        ? await (app.prisma as any).vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId }, select: { dominio: true } })
        : await (app.prisma as any).neumaticoPosicion.findFirst({
            where: { neumaticoId, activo: true, tenantId },
            select: { vehiculo: { select: { dominio: true } } },
          }).then((p: any) => p?.vehiculo);
      const posLabel = body.data.eje != null ? `Eje ${body.data.eje} ${body.data.lado || ''}/${body.data.posicion || ''}` : null;
      notifyBandaCritica(app.prisma, {
        tenantId,
        vehiculoDominio: veh?.dominio || 'Sin asignar',
        neumaticoCodigo: neum.codigo,
        profBanda: body.data.profBanda,
        posicion: posLabel,
        neumaticoId,
      }).catch(() => {});
    }

    return reply.code(201).send({ medicion });
  });

  // GET historial de mediciones de una cubierta (para curva de desgaste)
  app.get('/neumaticos/:id/mediciones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const mediciones = await (app.prisma as any).neumaticoMedicion.findMany({
      where: { neumaticoId: id, tenantId },
      orderBy: { fecha: 'asc' },
    });
    return reply.send({ mediciones });
  });

  // GET desgaste de cubiertas por vehículo: por posición + detección de desgaste irregular
  app.get('/vehiculos/:id/desgaste-cubiertas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const posiciones = await (app.prisma as any).neumaticoPosicion.findMany({
      where: { vehiculoId: id, tenantId, activo: true },
      include: {
        neumatico: {
          select: {
            id: true, codigo: true, marca: true, medida: true, condicion: true,
            profBanda: true, profBandaOriginal: true, kmAcumulados: true, presionRecomendada: true,
            mediciones: { orderBy: { fecha: 'desc' }, take: 10 },
          },
        },
      },
      orderBy: [{ eje: 'asc' }, { lado: 'asc' }],
    });

    // Tasa de desgaste por cubierta: usa historial de mediciones si hay ≥2, sino single-point
    const porPosicion = posiciones.map((p: any) => {
      const n = p.neumatico;
      if (!n) return null;
      const banda0 = n.profBandaOriginal ?? 8;
      const banda = n.profBanda ?? banda0;
      const kmAcum = n.kmAcumulados || 0;
      let tasaMmPor1000km: number | null = null;
      let kmRestantes: number | null = null;
      const meds = (n.mediciones || []).filter((m: any) => m.kmAlMedir != null);
      if (meds.length >= 2) {
        // Regresión lineal simple sobre mediciones con km
        const pts = meds.map((m: any) => ({ km: m.kmAlMedir, mm: m.profBanda })).sort((a: any, b: any) => a.km - b.km);
        const first = pts[0], last = pts[pts.length - 1];
        const dKm = last.km - first.km;
        if (dKm > 0) tasaMmPor1000km = ((first.mm - last.mm) / dKm) * 1000;
      }
      if (tasaMmPor1000km == null && kmAcum > 1000 && banda0 > banda) {
        tasaMmPor1000km = ((banda0 - banda) / kmAcum) * 1000;
      }
      if (tasaMmPor1000km != null && tasaMmPor1000km > 0) {
        kmRestantes = Math.round(((banda - 1.6) / tasaMmPor1000km) * 1000);
      }
      return {
        posicionId: p.id, eje: p.eje, lado: p.lado, posicion: p.posicion,
        neumaticoId: n.id, codigo: n.codigo, marca: n.marca, medida: n.medida, condicion: n.condicion,
        bandaActual: Math.round(banda * 10) / 10,
        bandaOriginal: banda0,
        desgastePct: banda0 > 1.6 ? Math.round(((banda0 - banda) / (banda0 - 1.6)) * 100) : null,
        kmAcumulados: Math.round(kmAcum),
        tasaMmPor1000km: tasaMmPor1000km != null ? Math.round(tasaMmPor1000km * 1000) / 1000 : null,
        kmRestantes,
        medicionesCount: (n.mediciones || []).length,
      };
    }).filter(Boolean);

    // Desgaste irregular: diferencia de banda entre cubiertas del mismo eje
    const alertasIrregular: any[] = [];
    const porEje: Record<number, any[]> = {};
    for (const p of porPosicion) {
      if (!porEje[p.eje]) porEje[p.eje] = [];
      porEje[p.eje].push(p);
    }
    for (const [eje, items] of Object.entries(porEje)) {
      if (items.length < 2) continue;
      const bandas = items.map((i: any) => i.bandaActual);
      const max = Math.max(...bandas), min = Math.min(...bandas);
      const diff = Math.round((max - min) * 10) / 10;
      if (diff >= 1.5) {
        alertasIrregular.push({
          eje: Number(eje),
          diferenciaMm: diff,
          cubiertas: items.map((i: any) => ({ codigo: i.codigo, lado: i.lado, banda: i.bandaActual })),
          mensaje: `Desgaste irregular en eje ${eje}: ${diff}mm de diferencia entre lados — posible problema de alineación o suspensión`,
        });
      }
    }

    return reply.send({ posiciones: porPosicion, alertasIrregular });
  });

  // ═══════════════════════════════════════════════════════════════
  // FACTURAS DE GASTOS (reparaciones, repuestos, services, cubiertas)
  // ═══════════════════════════════════════════════════════════════

  // Upload de archivo de factura (PDF/foto)
  app.post('/facturas/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(data.mimetype)) return reply.code(400).send({ error: 'Solo PDF o imágenes' });
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'flota-facturas', tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const ext = (data.filename.split('.').pop() || 'pdf').toLowerCase();
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), await data.toBuffer());
      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      return reply.send({ url: `${baseUrl}/uploads/flota-facturas/${tenantId}/${filename}`, name: data.filename, mimeType: data.mimetype });
    } catch (e: any) {
      console.error('[flota] factura upload error:', e);
      return reply.code(500).send({ error: 'No se pudo subir el archivo' });
    }
  });

  // GET facturas (filtros: vehiculoId, categoria, desde, hasta)
  app.get('/facturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId, categoria, desde, hasta } = req.query as any;
    const facturas = await (app.prisma as any).flotaFactura.findMany({
      where: {
        tenantId,
        ...(vehiculoId ? { vehiculoId } : {}),
        ...(categoria ? { categoria } : {}),
        ...(desde || hasta ? { fecha: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) } } : {}),
      },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { fecha: 'desc' },
      take: 300,
    });
    return reply.send({ facturas });
  });

  // GET facturas de un vehículo
  app.get('/vehiculos/:vehiculoId/facturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const facturas = await (app.prisma as any).flotaFactura.findMany({
      where: { vehiculoId, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ facturas });
  });

  // POST crear factura
  app.post('/facturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      vehiculoId: z.string().uuid().optional().nullable(),
      tipoComprobante: z.enum(['FACTURA', 'TICKET', 'NOTA_CREDITO', 'PRESUPUESTO', 'OTRO']).default('FACTURA'),
      numero: z.string().max(50).optional(),
      puntoVenta: z.string().max(20).optional(),
      fecha: z.string().optional(),
      proveedor: z.string().max(200).optional(),
      cuitProveedor: z.string().max(20).optional(),
      neto: z.number().nonnegative().optional(),
      iva: z.number().nonnegative().optional(),
      total: z.number().nonnegative(),
      concepto: z.string().max(300).optional(),
      categoria: z.enum(['REPARACION', 'REPUESTO', 'SERVICE', 'NEUMATICO', 'COMBUSTIBLE', 'OTRO']).default('REPARACION'),
      workOrderId: z.string().uuid().optional().nullable(),
      intervencionId: z.string().uuid().optional().nullable(),
      neumaticoId: z.string().uuid().optional().nullable(),
      sparePartId: z.string().uuid().optional().nullable(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      notas: z.string().max(500).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    if (body.data.vehiculoId) {
      const v = await (app.prisma as any).vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId } });
      if (!v) return reply.code(400).send({ error: 'Vehículo inválido' });
    }

    const user = (req as any).user;
    const factura = await (app.prisma as any).flotaFactura.create({
      data: {
        ...body.data,
        tenantId,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        uploadedById: user?.id || null,
        uploadedByNombre: user?.name || user?.email || null,
      },
    });
    return reply.code(201).send({ factura });
  });

  // DELETE factura
  app.delete('/facturas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).flotaFactura.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // MULTAS DE TRÁNSITO
  // ═══════════════════════════════════════════════════════════════

  // Upload de acta/boleta de multa
  app.post('/multas/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(data.mimetype)) return reply.code(400).send({ error: 'Solo PDF o imágenes' });
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'flota-multas', tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const ext = (data.filename.split('.').pop() || 'pdf').toLowerCase();
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), await data.toBuffer());
      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      return reply.send({ url: `${baseUrl}/uploads/flota-multas/${tenantId}/${filename}`, name: data.filename, mimeType: data.mimetype });
    } catch (e: any) {
      console.error('[flota] multa upload error:', e);
      return reply.code(500).send({ error: 'No se pudo subir el archivo' });
    }
  });

  // GET multas (filtros: estado, vehiculoId, conductorId)
  app.get('/multas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { estado, vehiculoId, conductorId } = req.query as any;
    const multas = await (app.prisma as any).flotaMulta.findMany({
      where: {
        tenantId,
        ...(estado ? { estado } : {}),
        ...(vehiculoId ? { vehiculoId } : {}),
        ...(conductorId ? { conductorId } : {}),
      },
      include: {
        vehiculo: { select: { id: true, dominio: true, tipo: true } },
        conductor: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 300,
    });
    return reply.send({ multas });
  });

  // POST crear multa
  app.post('/multas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      vehiculoId: z.string().uuid(),
      conductorId: z.string().uuid().optional().nullable(),
      tipo: z.enum(['TRANSITO', 'ESTACIONAMIENTO', 'DOCUMENTACION', 'EXCESO_VELOCIDAD', 'OTRO']).default('TRANSITO'),
      descripcion: z.string().max(500).optional(),
      actaNumero: z.string().max(100).optional(),
      lugar: z.string().max(300).optional(),
      fecha: z.string().optional(),
      monto: z.number().nonnegative(),
      fechaVtoPago: z.string().optional(),
      responsablePago: z.enum(['EMPRESA', 'CONDUCTOR']).optional().nullable(),
      incidenteId: z.string().uuid().optional().nullable(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      notas: z.string().max(500).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const v = await (app.prisma as any).vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId } });
    if (!v) return reply.code(400).send({ error: 'Vehículo inválido' });

    const multa = await (app.prisma as any).flotaMulta.create({
      data: {
        ...body.data,
        tenantId,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        fechaVtoPago: body.data.fechaVtoPago ? new Date(body.data.fechaVtoPago) : null,
      },
    });
    return reply.code(201).send({ multa });
  });

  // PATCH multa (cambiar estado, marcar pagada)
  app.patch('/multas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      estado: z.enum(['PENDIENTE', 'PAGADA', 'EN_DISPUTA', 'ANULADA']).optional(),
      responsablePago: z.enum(['EMPRESA', 'CONDUCTOR']).optional().nullable(),
      notas: z.string().max(500).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const upd: any = { ...body.data };
    if (body.data.estado === 'PAGADA') upd.pagadaAt = new Date();
    const updated = await (app.prisma as any).flotaMulta.updateMany({ where: { id, tenantId }, data: upd });
    if (!updated.count) return reply.code(404).send({ error: 'No encontrada' });
    return reply.send({ ok: true });
  });

  // DELETE multa
  app.delete('/multas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).flotaMulta.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMBUSTIBLE
  // ═══════════════════════════════════════════════════════════════

  // GET /combustible — últimas cargas de toda la flota (para la página de combustible)
  app.get('/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const registros = await (app.prisma as any).registroCombustible.findMany({
      where: { tenantId },
      include: {
        vehiculo: { select: { id: true, dominio: true, tipo: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
    // conductorId es campo plano (sin relación) — resolver nombres aparte
    const conductorIds = [...new Set(registros.map((r: any) => r.conductorId).filter(Boolean))];
    const conductores = conductorIds.length
      ? await (app.prisma as any).conductor.findMany({ where: { id: { in: conductorIds } }, select: { id: true, nombre: true } })
      : [];
    const porId = new Map(conductores.map((c: any) => [c.id, c.nombre]));
    for (const r of registros) r.conductorNombre = r.conductorId ? porId.get(r.conductorId) || null : null;
    return reply.send({ registros });
  });

  app.get('/vehiculos/:vehiculoId/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const registros = await (app.prisma as any).registroCombustible.findMany({
      where: { vehiculoId, tenantId },
      orderBy: { fecha: 'desc' },
    });
    return reply.send({ registros });
  });

  app.delete('/vehiculos/:vehiculoId/combustible/:registroId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { registroId } = req.params as any;
    await (app.prisma as any).registroCombustible.deleteMany({ where: { id: registroId, tenantId } });
    return reply.send({ ok: true });
  });

  // PATCH /vehiculos/:vehiculoId/combustible/:registroId - Editar carga
  app.patch('/vehiculos/:vehiculoId/combustible/:registroId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { registroId } = req.params as any;
    const schema = z.object({
      litros: z.number().positive().optional(),
      precioPorLitro: z.number().optional().nullable(),
      odometro: z.number().optional().nullable(),
      estacion: z.string().optional().nullable(),
      tipoCombustible: z.string().optional(),
      litrosUrea: z.number().nonnegative().optional().nullable(),
      precioPorLitroUrea: z.number().nonnegative().optional().nullable(),
      conductorId: z.string().uuid().optional().nullable(),
      fecha: z.string().optional(),
      notas: z.string().optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const actual = await (app.prisma as any).registroCombustible.findFirst({ where: { id: registroId, tenantId } });
    if (!actual) return reply.code(404).send({ error: 'Registro no encontrado' });

    const litros = body.data.litros ?? actual.litros;
    const precioPorLitro = body.data.precioPorLitro !== undefined ? body.data.precioPorLitro : actual.precioPorLitro;
    const litrosUrea = body.data.litrosUrea !== undefined ? body.data.litrosUrea : actual.litrosUrea;
    const precioPorLitroUrea = body.data.precioPorLitroUrea !== undefined ? body.data.precioPorLitroUrea : actual.precioPorLitroUrea;
    const costoCombustible = precioPorLitro && litros ? litros * precioPorLitro : 0;
    const costoUrea = litrosUrea && precioPorLitroUrea ? litrosUrea * precioPorLitroUrea : null;
    const costoTotal = (costoCombustible || costoUrea) ? (costoCombustible + (costoUrea || 0)) : null;

    const registro = await (app.prisma as any).registroCombustible.update({
      where: { id: registroId },
      data: {
        ...body.data,
        fecha: body.data.fecha ? new Date(body.data.fecha) : undefined,
        costoTotal,
        costoUrea,
      },
    });
    return reply.send({ registro });
  });

  app.post('/vehiculos/:vehiculoId/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    const schema = z.object({
      litros: z.number().positive(),
      precioPorLitro: z.number().optional(),
      odometro: z.number().optional(),
      estacion: z.string().optional(),
      tipoCombustible: z.string().default('DIESEL'),
      litrosUrea: z.number().nonnegative().optional(),
      precioPorLitroUrea: z.number().nonnegative().optional(),
      conductorId: z.string().uuid().optional().nullable(),
      fecha: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Calcular rendimiento vs carga anterior
    let rendimiento: number | null = null;
    if (body.data.odometro) {
      const anterior = await (app.prisma as any).registroCombustible.findFirst({
        where: { vehiculoId, tenantId, odometro: { not: null } },
        orderBy: { fecha: 'desc' },
      });
      if (anterior?.odometro && body.data.odometro > anterior.odometro) {
        rendimiento = (body.data.odometro - anterior.odometro) / body.data.litros;
        rendimiento = Math.round(rendimiento * 100) / 100;
      }
      // Actualizar odómetro del vehículo
      await (app.prisma as any).vehiculo.updateMany({ where: { id: vehiculoId }, data: { currentOdometer: body.data.odometro } });
      
      // Verificar planes de mantenimiento por KM (ejecutar en background)
      verificarPlanesPorKm(app.prisma, tenantId, vehiculoId, body.data.odometro).catch(() => {});
    }

    const costoCombustible = body.data.precioPorLitro ? body.data.litros * body.data.precioPorLitro : 0;
    const costoUrea = body.data.litrosUrea && body.data.precioPorLitroUrea
      ? body.data.litrosUrea * body.data.precioPorLitroUrea
      : null;
    const costoTotal = (costoCombustible || costoUrea) ? (costoCombustible + (costoUrea || 0)) : null;
    const registro = await (app.prisma as any).registroCombustible.create({
      data: {
        ...body.data,
        vehiculoId,
        tenantId,
        costoTotal,
        costoUrea,
        rendimiento,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
      },
    });
    return reply.code(201).send({ registro });
  });

  // ═══════════════════════════════════════════════════════════════
  // REPUESTOS EN OT
  // ═══════════════════════════════════════════════════════════════

  app.get('/ot-repuestos/:workOrderId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { workOrderId } = req.params as any;
    const repuestos = await (app.prisma as any).oTRepuesto.findMany({
      where: { workOrderId, tenantId },
    });
    return reply.send({ repuestos });
  });

  app.post('/ot-repuestos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      workOrderId: z.string().uuid(),
      sparePartId: z.string().uuid(),
      cantidad: z.number().positive(),
      precioUnit: z.number().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const subtotal = body.data.precioUnit ? body.data.cantidad * body.data.precioUnit : null;
    const otRepuesto = await (app.prisma as any).oTRepuesto.create({ data: { ...body.data, subtotal, tenantId } });
    // Descontar del stock
    await (app.prisma as any).maintenanceSparePart.updateMany({
      where: { id: body.data.sparePartId },
      data: { currentStock: { decrement: body.data.cantidad } },
    });
    return reply.code(201).send({ otRepuesto });
  });

  app.delete('/ot-repuestos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const otRep = await (app.prisma as any).oTRepuesto.findFirst({ where: { id, tenantId } });
    if (!otRep) return reply.code(404).send({ error: 'No encontrado' });
    // Reponer stock
    await (app.prisma as any).maintenanceSparePart.updateMany({
      where: { id: otRep.sparePartId },
      data: { currentStock: { increment: otRep.cantidad } },
    });
    await (app.prisma as any).oTRepuesto.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD EJECUTIVO
  // ═══════════════════════════════════════════════════════════════

  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const hoy = new Date();
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);

    const [
      vehiculos,
      neumaticos,
      vencimientos,
      combustibleMes,
      combustibleMesAnt,
      otAbiertas,
      otCerradasMes,
      otUltimas30,
      conductores,
    ] = await Promise.all([
      (app.prisma as any).vehiculo.findMany({
        where: { tenantId },
        select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true },
      }),
      (app.prisma as any).neumatico.findMany({
        where: { tenantId },
        select: { id: true, status: true, kmAcumulados: true, profBanda: true },
      }),
      (app.prisma as any).vencimientoDocumento.findMany({
        where: { tenantId, renovado: false, fechaVto: { lte: en30dias } },
        include: { vehiculo: { select: { dominio: true } } },
        orderBy: { fechaVto: 'asc' },
      }),
      (app.prisma as any).registroCombustible.findMany({
        where: { tenantId, fecha: { gte: inicioMes } },
        select: { vehiculoId: true, litros: true, costoTotal: true, rendimiento: true, litrosUrea: true, costoUrea: true },
      }),
      (app.prisma as any).registroCombustible.findMany({
        where: { tenantId, fecha: { gte: inicioMesAnterior, lte: finMesAnterior } },
        select: { litros: true, costoTotal: true },
      }),
      (app.prisma as any).workOrder.count({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      (app.prisma as any).workOrder.findMany({
        where: { tenantId, completedAt: { gte: inicioMes }, status: 'COMPLETED' },
        select: { id: true, startedAt: true, completedAt: true, totalCost: true, type: true },
      }),
      (app.prisma as any).workOrder.findMany({
        where: { tenantId, createdAt: { gte: hace30 } },
        select: { id: true, status: true, type: true, priority: true, totalCost: true, startedAt: true, completedAt: true, createdAt: true },
      }),
      (app.prisma as any).conductor.findMany({
        where: { tenantId, status: 'ACTIVO' },
        select: { id: true, nombre: true, licenciaVto: true, psicofisicoVto: true },
      }),
    ]);

    // ── KPIs Flota ────────────────────────────────────────────────
    const totalVeh = vehiculos.length;
    const activosCount = vehiculos.filter((v: any) => v.status === 'ACTIVO').length;
    const enTallerCount = vehiculos.filter((v: any) => v.status === 'EN_TALLER').length;
    const disponibilidadPct = totalVeh > 0 ? Math.round((activosCount / totalVeh) * 100) : 0;

    // Combustible
    const litrosMes = combustibleMes.reduce((s: number, r: any) => s + (r.litros || 0), 0);
    const costoCombuMes = combustibleMes.reduce((s: number, r: any) => s + (r.costoTotal || 0), 0);
    const litrosMesAnt = combustibleMesAnt.reduce((s: number, r: any) => s + (r.litros || 0), 0);
    const costoCombuMesAnt = combustibleMesAnt.reduce((s: number, r: any) => s + (r.costoTotal || 0), 0);
    const rendimientos = combustibleMes.filter((r: any) => r.rendimiento != null).map((r: any) => r.rendimiento);
    const promedioKmL = rendimientos.length > 0 ? Math.round((rendimientos.reduce((s: number, r: number) => s + r, 0) / rendimientos.length) * 100) / 100 : null;
    // L/100km: inverso de km/L * 100
    const l100km = promedioKmL && promedioKmL > 0 ? Math.round((100 / promedioKmL) * 100) / 100 : null;

    // Urea (AdBlue): litros, costo y ratio urea/diesel (~5-7% es normal; fuera de rango = posible problema SCR)
    const litrosUreaMes = combustibleMes.reduce((s: number, r: any) => s + (r.litrosUrea || 0), 0);
    const costoUreaMes = combustibleMes.reduce((s: number, r: any) => s + (r.costoUrea || 0), 0);
    const ratioUreaDiesel = litrosMes > 0 ? Math.round((litrosUreaMes / litrosMes) * 1000) / 10 : null; // % con 1 decimal

    // Consumo por vehículo este mes
    const consumoPorVeh: Record<string, { litros: number; costo: number }> = {};
    for (const r of combustibleMes as any[]) {
      if (!consumoPorVeh[r.vehiculoId]) consumoPorVeh[r.vehiculoId] = { litros: 0, costo: 0 };
      consumoPorVeh[r.vehiculoId].litros += r.litros || 0;
      consumoPorVeh[r.vehiculoId].costo += r.costoTotal || 0;
    }
    const topConsumidores = vehiculos
      .filter((v: any) => consumoPorVeh[v.id])
      .map((v: any) => ({ dominio: v.dominio, tipo: v.tipo, ...consumoPorVeh[v.id] }))
      .sort((a: any, b: any) => b.litros - a.litros)
      .slice(0, 5);

    // Neumáticos en alerta (banda < 3mm o km > 80k)
    const neumaticosAlerta = neumaticos.filter((n: any) =>
      (n.profBanda != null && n.profBanda < 3) || n.kmAcumulados > 80000
    ).length;
    const neumaticosDisponibles = neumaticos.filter((n: any) => n.status === 'DISPONIBLE').length;
    const neumaticosMontados = neumaticos.filter((n: any) => n.status === 'EN_USO').length;

    // Vencimientos críticos (vencidos = fecha < hoy)
    const vencimientosVencidos = vencimientos.filter((v: any) => new Date(v.fechaVto) < hoy);
    const vencimientosProximos = vencimientos.filter((v: any) => new Date(v.fechaVto) >= hoy);

    // Conductores con documentos por vencer
    const conductoresAlerta = conductores.filter((c: any) => {
      const licDias = c.licenciaVto ? Math.ceil((new Date(c.licenciaVto).getTime() - hoy.getTime()) / 86400000) : 999;
      const psicoDias = c.psicofisicoVto ? Math.ceil((new Date(c.psicofisicoVto).getTime() - hoy.getTime()) / 86400000) : 999;
      return licDias <= 30 || psicoDias <= 30;
    }).map((c: any) => {
      const licDias = c.licenciaVto ? Math.ceil((new Date(c.licenciaVto).getTime() - hoy.getTime()) / 86400000) : null;
      const psicoDias = c.psicofisicoVto ? Math.ceil((new Date(c.psicofisicoVto).getTime() - hoy.getTime()) / 86400000) : null;
      return { nombre: c.nombre, licDias, psicoDias };
    });

    // ── KPIs Mantenimiento ────────────────────────────────────────
    const otCerradas = otCerradasMes.length;
    // MTTR: tiempo medio de reparación en horas
    const otConDuracion = otCerradasMes.filter((o: any) => o.startedAt && o.completedAt);
    const mttr = otConDuracion.length > 0
      ? Math.round(otConDuracion.reduce((s: number, o: any) => {
          return s + (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000;
        }, 0) / otConDuracion.length * 10) / 10
      : null;

    const costoOTMes = otCerradasMes.reduce((s: number, o: any) => s + (o.totalCost || 0), 0);

    // OTs por tipo (últimas 30 días)
    const otPorTipo: Record<string, number> = {};
    for (const o of otUltimas30 as any[]) {
      otPorTipo[o.type] = (otPorTipo[o.type] || 0) + 1;
    }
    const otPorPrioridad: Record<string, number> = {};
    for (const o of otUltimas30 as any[]) {
      otPorPrioridad[o.priority] = (otPorPrioridad[o.priority] || 0) + 1;
    }

    // Tendencia OTs: agrupar por semana
    const otPorSemana: Record<string, { abiertas: number; cerradas: number }> = {};
    for (const o of otUltimas30 as any[]) {
      const sem = `S${Math.ceil(new Date(o.createdAt).getDate() / 7)}`;
      if (!otPorSemana[sem]) otPorSemana[sem] = { abiertas: 0, cerradas: 0 };
      if (o.status === 'COMPLETED') otPorSemana[sem].cerradas++;
      else otPorSemana[sem].abiertas++;
    }

    return reply.send({
      flota: {
        totalVehiculos: totalVeh,
        activos: activosCount,
        enTaller: enTallerCount,
        inactivos: totalVeh - activosCount - enTallerCount,
        disponibilidadPct,
        combustible: {
          litrosMes: Math.round(litrosMes * 10) / 10,
          costoMes: Math.round(costoCombuMes),
          litrosMesAnt: Math.round(litrosMesAnt * 10) / 10,
          costoMesAnt: Math.round(costoCombuMesAnt),
          variacionLitros: litrosMesAnt > 0 ? Math.round(((litrosMes - litrosMesAnt) / litrosMesAnt) * 100) : null,
          promedioKmL,
          l100km,
          urea: {
            litrosMes: Math.round(litrosUreaMes * 10) / 10,
            costoMes: Math.round(costoUreaMes),
            ratioDieselPct: ratioUreaDiesel,
            fueraDeRango: ratioUreaDiesel != null && (ratioUreaDiesel < 3 || ratioUreaDiesel > 9),
          },
        },
        topConsumidores,
        neumaticos: {
          total: neumaticos.length,
          disponibles: neumaticosDisponibles,
          montados:neumaticosMontados,
          enAlerta: neumaticosAlerta,
        },
        vencimientos: {
          vencidos: vencimientosVencidos.length,
          proximos: vencimientosProximos.length,
          lista: vencimientos.slice(0, 8).map((v: any) => ({
            tipo: v.tipo,
            dominio: v.vehiculo?.dominio,
            fechaVto: v.fechaVto,
            diasRestantes: Math.ceil((new Date(v.fechaVto).getTime() - hoy.getTime()) / 86400000),
          })),
        },
        conductores: {
          total: conductores.length,
          enAlerta: conductoresAlerta,
        },
      },
      mantenimiento: {
        otAbiertas,
        otCerradasMes: otCerradas,
        mttrHoras: mttr,
        costoOTMes: Math.round(costoOTMes),
        otPorTipo: Object.entries(otPorTipo).map(([tipo, count]) => ({ tipo, count })),
        otPorPrioridad: Object.entries(otPorPrioridad).map(([prioridad, count]) => ({ prioridad, count })),
        tendencia: Object.entries(otPorSemana).map(([semana, v]) => ({ semana, ...v })),
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STATS / DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const hoy = new Date();
    const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30);

    const [totalVehiculos, activos, enTaller, vencimientosProximos, conductores, neumaticos] = await Promise.all([
      (app.prisma as any).vehiculo.count({ where: { tenantId } }),
      (app.prisma as any).vehiculo.count({ where: { tenantId, status: 'ACTIVO' } }),
      (app.prisma as any).vehiculo.count({ where: { tenantId, status: 'EN_TALLER' } }),
      (app.prisma as any).vencimientoDocumento.count({ where: { tenantId, renovado: false, fechaVto: { lte: en30dias } } }),
      (app.prisma as any).conductor.count({ where: { tenantId, status: 'ACTIVO' } }),
      (app.prisma as any).neumatico.count({ where: { tenantId } }),
    ]);
    return reply.send({ stats: { totalVehiculos, activos, enTaller, vencimientosProximos, conductores, neumaticos } });
  });

  // ═══════════════════════════════════════════════════════════════
  // PLANES DE MANTENIMIENTO POR KM
  // ═══════════════════════════════════════════════════════════════

  // Obtener planes de mantenimiento por KM próximos a vencer para un vehículo
  app.get('/vehiculos/:vehiculoId/planes-km', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;
    
    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { id: true, dominio: true, currentOdometer: true },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    
    const planes = await (app.prisma as any).maintenancePlan.findMany({
      where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM', assetId: vehiculoId },
      select: { id: true, code: true, title: true, triggerKm: true, lastOdometerExecution: true },
    });
    
    const planesConAlerta = planes.map((p: any) => {
      const kmDesdeUltima = vehiculo.currentOdometer && p.lastOdometerExecution 
        ? vehiculo.currentOdometer - p.lastOdometerExecution 
        : 0;
      const kmRestantes = (p.triggerKm || 0) - kmDesdeUltima;
      const porcentaje = p.triggerKm > 0 ? Math.round((kmDesdeUltima / p.triggerKm) * 100) : 0;
      return {
        ...p,
        kmDesdeUltima: Math.round(kmDesdeUltima),
        kmRestantes: Math.round(kmRestantes),
        porcentajeUso: porcentaje,
        alerta: porcentaje >= 90 ? 'CRITICAL' : porcentaje >= 80 ? 'WARNING' : null,
      };
    }).sort((a: any, b: any) => b.porcentajeUso - a.porcentajeUso);
    
    return reply.send({ vehiculo, planes: planesConAlerta });
  });

  // Verificar planes por KM para toda la flota (dashboard)
  app.get('/planes-km/pendientes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    
    const [vehiculos, planes] = await Promise.all([
      (app.prisma as any).vehiculo.findMany({
        where: { tenantId, status: 'ACTIVO' },
        select: { id: true, dominio: true, currentOdometer: true, tipo: true },
      }),
      (app.prisma as any).maintenancePlan.findMany({
        where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM' },
        select: { id: true, code: true, title: true, triggerKm: true, lastOdometerExecution: true, assetId: true },
      }),
    ]);
    
    const vehMap = new Map((vehiculos as any[]).map((v: any) => [v.id, v]));
    
    const pendientes = (planes as any[])
      .map((p: any) => {
        const veh = vehMap.get(p.assetId) as any;
        if (!veh || !veh.currentOdometer) return null;
        const kmDesdeUltima = p.lastOdometerExecution 
          ? veh.currentOdometer - p.lastOdometerExecution 
          : veh.currentOdometer;
        const kmRestantes = (p.triggerKm || 0) - kmDesdeUltima;
        const porcentaje = p.triggerKm > 0 ? (kmDesdeUltima / p.triggerKm) * 100 : 0;
        if (porcentaje < 70) return null; // Solo mostrar los que están al 70% o más
        return {
          planId: p.id,
          planCode: p.code,
          planTitle: p.title,
          triggerKm: p.triggerKm,
          vehiculoId: veh.id,
          dominio: veh.dominio,
          tipo: veh.tipo,
          kmDesdeUltima: Math.round(kmDesdeUltima),
          kmRestantes: Math.round(kmRestantes),
          porcentajeUso: Math.round(porcentaje),
          alerta: porcentaje >= 90 ? 'CRITICAL' : porcentaje >= 80 ? 'WARNING' : 'INFO',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.porcentajeUso - a.porcentajeUso);
    
    return reply.send({ pendientes, total: pendientes.length, critical: pendientes.filter((p: any) => p.alerta === 'CRITICAL').length });
  });

  // ═══════════════════════════════════════════════════════════════
  // ANÁLISIS TCO (Total Cost of Ownership) — Costo por KM
  // ═══════════════════════════════════════════════════════════════

  app.get('/tco/analisis', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const { desde, hasta } = req.query as any;
    const fechaDesde = desde ? new Date(desde) : new Date(new Date().getFullYear(), 0, 1);
    const fechaHasta = hasta ? new Date(hasta) : new Date();

    // Obtener todos los vehículos activos
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId, status: 'ACTIVO' },
      select: { id: true, dominio: true, tipo: true, currentOdometer: true, marca: true, modelo: true, maintenanceAssetId: true },
    });

    const resultados = await Promise.all((vehiculos as any[]).map(async (v: any) => {
      // 1. Costo de combustible
      const combustibleAgg = await (app.prisma as any).registroCombustible.aggregate({
        where: { vehiculoId: v.id, tenantId, fecha: { gte: fechaDesde, lte: fechaHasta } },
        _sum: { costoTotal: true, litros: true },
      });

      // 2. Costo de mantenimiento (OTs) — el vínculo es vía maintenanceAssetId y la fecha real es completedAt
      const mantenimientoAgg = v.maintenanceAssetId
        ? await (app.prisma as any).workOrder.aggregate({
            where: {
              tenantId,
              assetId: v.maintenanceAssetId,
              status: 'COMPLETED',
              completedAt: { gte: fechaDesde, lte: fechaHasta },
            },
            _sum: { totalCost: true, laborCost: true, partsCost: true },
            _count: true,
          })
        : { _sum: { totalCost: 0, laborCost: 0, partsCost: 0 }, _count: 0 };

      // 3. Costo de neumáticos (desmontajes en el período) — precioCompra + recaps reales
      const posicionesDesmontadas = await (app.prisma as any).neumaticoPosicion.findMany({
        where: {
          vehiculoId: v.id,
          tenantId,
          desmontadoAt: { gte: fechaDesde, lte: fechaHasta },
          activo: false,
        },
        select: { neumatico: { select: { precioCompra: true, recaps: { select: { costo: true } } } } },
      });
      const costoNeumaticos = posicionesDesmontadas.reduce((s: number, p: any) => {
        const n = p.neumatico;
        if (!n) return s;
        const recaps = (n.recaps || []).reduce((a: number, r: any) => a + (r.costo || 0), 0);
        return s + (n.precioCompra || 0) + recaps;
      }, 0);

      // Calcular totales
      const costoCombustible = combustibleAgg._sum?.costoTotal || 0;
      const costoMantenimiento = mantenimientoAgg._sum?.totalCost || 0;

      const costoTotal = costoCombustible + costoMantenimiento + costoNeumaticos;
      const kmRecorridos = v.currentOdometer || 0;
      const costoPorKm = kmRecorridos > 0 ? costoTotal / kmRecorridos : 0;

      return {
        vehiculoId: v.id,
        dominio: v.dominio,
        tipo: v.tipo,
        marca: v.marca,
        modelo: v.modelo,
        kmRecorridos: Math.round(kmRecorridos),
        costoTotal: Math.round(costoTotal),
        costoPorKm: Math.round(costoPorKm * 100) / 100,
        desglose: {
          combustible: Math.round(costoCombustible),
          mantenimiento: Math.round(costoMantenimiento),
          neumaticos: Math.round(costoNeumaticos),
        },
        eficiencia: {
          litrosTotales: Math.round((combustibleAgg._sum?.litros || 0) * 100) / 100,
          rendimientoPromedio: combustibleAgg._sum?.litros > 0 
            ? Math.round((kmRecorridos / combustibleAgg._sum.litros) * 100) / 100 
            : 0,
          otsCompletadas: mantenimientoAgg._count || 0,
        },
        alerta: costoPorKm > 150 ? 'HIGH_COST' : costoPorKm > 100 ? 'MEDIUM_COST' : 'NORMAL',
      };
    }));

    // Ordenar por costo por km (mayor a menor)
    resultados.sort((a: any, b: any) => b.costoPorKm - a.costoPorKm);

    return reply.send({
      periodo: { desde: fechaDesde, hasta: fechaHasta },
      totalVehiculos: resultados.length,
      promedioCostoPorKm: Math.round((resultados.reduce((s: number, r: any) => s + r.costoPorKm, 0) / (resultados.length || 1)) * 100) / 100,
      vehiculos: resultados,
    });
  });

  // TCO por vehículo individual
  app.get('/vehiculos/:vehiculoId/tco', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId } = req.params as any;

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { id: true, dominio: true, tipo: true, currentOdometer: true, marca: true, modelo: true, anio: true },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'Vehículo no encontrado' });

    // Historial mensual de costos
    const historial = await (app.prisma as any).$queryRaw`
      SELECT 
        DATE_TRUNC('month', fecha) as mes,
        SUM(costo_total) as combustible,
        COUNT(*) as cargas
      FROM flota_registros_combustible
      WHERE vehiculo_id = ${vehiculoId} AND tenant_id = ${tenantId}
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY mes DESC
      LIMIT 12
    `.catch(() => []);

    // Mantenimiento por tipo
    const mantenimientoPorTipo = await (app.prisma as any).$queryRaw`
      SELECT 
        type,
        COUNT(*) as cantidad,
        SUM(total_cost) as costo
      FROM work_orders
      WHERE asset_id = ${vehiculoId} AND tenant_id = ${tenantId} AND status = 'COMPLETED'
      GROUP BY type
    `.catch(() => []);

    return reply.send({ vehiculo, historial, mantenimientoPorTipo });
  });

  // ═══════════════════════════════════════════════════════════════
  // PANEL — Scorecard de conductores, KPIs de flota y vista ejecutiva
  // ═══════════════════════════════════════════════════════════════

  // GET scorecard de conductores: rating 0-100 por chofer con desglose de penalizaciones
  app.get('/conductores/scorecard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const conductores = await (app.prisma as any).conductor.findMany({
      where: { tenantId },
      select: {
        id: true, nombre: true, categoria: true, status: true,
        licenciaVto: true, psicofisicoVto: true,
        vehiculos: { select: { id: true, dominio: true, tipo: true } },
        multas: { select: { id: true, monto: true, estado: true, tipo: true, createdAt: true } },
      },
    });

    const ahora = new Date();
    const hace6m = new Date(ahora.getFullYear(), ahora.getMonth() - 6, 1);
    const hace30d = new Date(ahora.getTime() - 30 * 86400000);
    const hace60d = new Date(ahora.getTime() - 60 * 86400000);

    // Rendimiento de combustible por conductor (km/L) de los últimos 6 meses.
    // El modelo no tiene kmRecorridos: se deriva de rendimiento (km/L) * litros.
    const cargas = await (app.prisma as any).registroCombustible.findMany({
      where: { tenantId, conductorId: { not: null }, fecha: { gte: hace6m }, litros: { not: null }, rendimiento: { not: null } },
      select: { conductorId: true, litros: true, rendimiento: true },
    });
    const rendPorConductor = new Map<string, { km: number; litros: number }>();
    for (const c of cargas) {
      const acc = rendPorConductor.get(c.conductorId) || { km: 0, litros: 0 };
      acc.km += (c.rendimiento || 0) * (c.litros || 0);
      acc.litros += c.litros || 0;
      rendPorConductor.set(c.conductorId, acc);
    }
    // Promedio de flota para comparar eficiencia
    let kmTot = 0, litTot = 0;
    rendPorConductor.forEach((v) => { kmTot += v.km; litTot += v.litros; });
    const rendFlota = litTot > 0 ? kmTot / litTot : null;

    // Incidentes por vehículo (se atribuyen al conductor asignado a la unidad)
    const vehiculoIds = conductores.flatMap((c: any) => c.vehiculos.map((v: any) => v.id));
    const incidentes = vehiculoIds.length
      ? await (app.prisma as any).flotaIncidente.findMany({
          where: { tenantId, vehiculoId: { in: vehiculoIds }, createdAt: { gte: hace6m } },
          select: { vehiculoId: true, tipo: true, gravedad: true, createdAt: true },
        })
      : [];

    // Presiones bajas en vehículos asignados (indicio de no controlar presión)
    const presionesBajas = vehiculoIds.length
      ? await (app.prisma as any).neumaticoPresion.findMany({
          where: { tenantId, vehiculoId: { in: vehiculoIds }, fecha: { gte: hace6m } },
          select: { vehiculoId: true, presionMedida: true, fecha: true, neumatico: { select: { presionRecomendada: true } } },
        })
      : [];

    // Desgaste irregular de cubiertas en vehículos asignados (posible mala conducción/presión)
    const daniosIrregulares = vehiculoIds.length
      ? await (app.prisma as any).neumaticoDanio.findMany({
          where: { tenantId, tipo: 'DESGASTE_IRREGULAR', createdAt: { gte: hace6m } },
          select: { createdAt: true, severidad: true, neumatico: { select: { posiciones: { where: { activo: true }, select: { vehiculoId: true }, take: 1 } } } },
        }).catch(() => [])
      : [];

    // Inspecciones QR hechas por el chofer (bonus por reporte proactivo)
    const inspecciones = await (app.prisma as any).inspeccion.findMany({
      where: { tenantId, createdAt: { gte: hace6m } },
      select: { inspectorNombre: true, conductor: true, hallazgosCount: true, createdAt: true },
    }).catch(() => []);

    // ── Función de puntuación reutilizable (para score total y tendencia mensual) ──
    const PESO_MULTA: Record<string, number> = { EXCESO_VELOCIDAD: 10, TRANSITO: 6, DOCUMENTACION: 4, ESTACIONAMIENTO: 2, OTRO: 5 };
    const LABEL_MULTA: Record<string, string> = { EXCESO_VELOCIDAD: 'Exceso de velocidad', TRANSITO: 'Infracción de tránsito', DOCUMENTACION: 'Documentación', ESTACIONAMIENTO: 'Estacionamiento', OTRO: 'Otra infracción' };
    const PESO_INC: Record<string, number> = { CRITICA: 12, ALTA: 8, MEDIA: 5, BAJA: 3 };

    const puntuar = (c: any, desde: Date | null, hasta: Date | null, incluirFijos: boolean) => {
      const vehIds = new Set(c.vehiculos.map((v: any) => v.id));
      const enRango = (d: any) => { const t = new Date(d).getTime(); return (!desde || t >= desde.getTime()) && (!hasta || t < hasta.getTime()); };
      const penalizaciones: { motivo: string; puntos: number; detalle: string }[] = [];
      const bonificaciones: { motivo: string; puntos: number; detalle: string }[] = [];

      // Multas por tipo (excluye anuladas/en disputa)
      const multasValidas = c.multas.filter((m: any) => m.estado !== 'ANULADA' && m.estado !== 'EN_DISPUTA' && enRango(m.createdAt));
      const multasPorTipo = new Map<string, number>();
      for (const m of multasValidas) multasPorTipo.set(m.tipo, (multasPorTipo.get(m.tipo) || 0) + 1);
      multasPorTipo.forEach((cant, tipo) => penalizaciones.push({ motivo: LABEL_MULTA[tipo] || tipo, puntos: cant * (PESO_MULTA[tipo] ?? 5), detalle: `${cant} multa${cant !== 1 ? 's' : ''}` }));

      // Incidentes por gravedad
      const inc = incidentes.filter((i: any) => vehIds.has(i.vehiculoId) && enRango(i.createdAt));
      const incPts = inc.reduce((s: number, i: any) => s + (PESO_INC[i.gravedad] || 3), 0);
      if (inc.length) penalizaciones.push({ motivo: 'Incidentes en ruta', puntos: incPts, detalle: `${inc.length} reportado${inc.length !== 1 ? 's' : ''}` });

      // Presiones bajas (máx -10)
      const presBajas = presionesBajas.filter((p: any) => vehIds.has(p.vehiculoId) && enRango(p.fecha) && p.neumatico?.presionRecomendada && p.presionMedida < p.neumatico.presionRecomendada * 0.85);
      if (presBajas.length) penalizaciones.push({ motivo: 'Presión baja sin corregir', puntos: Math.min(presBajas.length * 2, 10), detalle: `${presBajas.length} registro${presBajas.length !== 1 ? 's' : ''} <85% de lo recomendado` });

      // Desgaste irregular de cubiertas (-4 c/u, máx -12)
      const danios = daniosIrregulares.filter((d: any) => enRango(d.createdAt) && d.neumatico?.posiciones?.[0] && vehIds.has(d.neumatico.posiciones[0].vehiculoId));
      if (danios.length) penalizaciones.push({ motivo: 'Desgaste irregular de cubiertas', puntos: Math.min(danios.length * 4, 12), detalle: `${danios.length} caso${danios.length !== 1 ? 's' : ''} en sus unidades` });

      // Bonus: inspecciones QR hechas por el chofer (reporte proactivo)
      const nombreNorm = (c.nombre || '').trim().toLowerCase();
      const insps = inspecciones.filter((i: any) => enRango(i.createdAt) && nombreNorm && ((i.inspectorNombre || '').trim().toLowerCase() === nombreNorm || (i.conductor || '').trim().toLowerCase() === nombreNorm));
      const conHallazgos = insps.filter((i: any) => (i.hallazgosCount || 0) > 0).length;
      if (insps.length) bonificaciones.push({ motivo: 'Checklists pre-viaje realizados', puntos: Math.min(insps.length, 4), detalle: `${insps.length} inspección${insps.length !== 1 ? 'es' : ''}` });
      if (conHallazgos) bonificaciones.push({ motivo: 'Hallazgos reportados proactivamente', puntos: Math.min(conHallazgos, 4), detalle: `${conHallazgos} inspección${conHallazgos !== 1 ? 'es' : ''} con hallazgos` });

      // Factores "fijos" solo en el score total (no en ventanas mensuales)
      let kmL: number | null = null;
      let kmRecorridos = 0;
      if (incluirFijos) {
        const rend = rendPorConductor.get(c.id);
        kmL = rend && rend.litros > 0 ? rend.km / rend.litros : null;
        kmRecorridos = rend?.km || 0;
        if (kmL != null && rendFlota != null && rendFlota > 0) {
          const diff = (rendFlota - kmL) / rendFlota;
          if (diff > 0.15) penalizaciones.push({ motivo: 'Consumo alto de combustible', puntos: 10, detalle: `${kmL.toFixed(2)} km/L vs ${rendFlota.toFixed(2)} promedio` });
          else if (diff > 0.08) penalizaciones.push({ motivo: 'Consumo sobre promedio', puntos: 5, detalle: `${kmL.toFixed(2)} km/L vs ${rendFlota.toFixed(2)} promedio` });
          else if (diff < -0.10) bonificaciones.push({ motivo: 'Eficiencia destacada', puntos: 5, detalle: `${kmL.toFixed(2)} km/L, ${Math.round(-diff * 100)}% mejor que la flota` });
        }
        const docsVencidos = [c.licenciaVto, c.psicofisicoVto].filter((d) => d && new Date(d) < ahora).length;
        if (docsVencidos) penalizaciones.push({ motivo: 'Documentación vencida', puntos: docsVencidos * 6, detalle: `${docsVencidos} doc${docsVencidos !== 1 ? 's' : ''} vencida${docsVencidos !== 1 ? 's' : ''}` });
      }

      const score = Math.max(0, Math.min(100, 100 - penalizaciones.reduce((s, p) => s + p.puntos, 0) + bonificaciones.reduce((s, b) => s + b.puntos, 0)));
      return { score, penalizaciones, bonificaciones, kmL, kmRecorridos, multasValidas, inc, presBajas, danios, insps };
    };

    const scorecard = conductores.map((c: any) => {
      const total = puntuar(c, hace6m, null, true);
      const mesActual = puntuar(c, hace30d, null, false);
      const mesAnterior = puntuar(c, hace60d, hace30d, false);
      const tendencia = mesActual.score - mesAnterior.score; // >0 mejora, <0 empeora

      const score = total.score;
      const rating = score >= 90 ? 'EXCELENTE' : score >= 75 ? 'BUENO' : score >= 60 ? 'REGULAR' : score >= 40 ? 'DEFICIENTE' : 'CRITICO';
      const confianza = total.kmRecorridos >= 5000 ? 'ALTA' : total.kmRecorridos >= 2000 ? 'MEDIA' : 'BAJA';
      const multasPend = c.multas.filter((m: any) => m.estado === 'PENDIENTE').length;

      return {
        id: c.id, nombre: c.nombre, categoria: c.categoria, status: c.status,
        vehiculos: c.vehiculos.map((v: any) => v.dominio),
        score, rating, confianza, tendencia,
        penalizaciones: total.penalizaciones, bonificaciones: total.bonificaciones,
        stats: {
          multas: total.multasValidas.length, multasPendientes: multasPend,
          incidentes: total.inc.length, presionesBajas: total.presBajas.length,
          desgasteIrregular: total.danios.length, inspecciones: total.insps.length,
          kmPorLitro: total.kmL != null ? Number(total.kmL.toFixed(2)) : null,
          kmRecorridos: Math.round(total.kmRecorridos),
        },
      };
    }).sort((a: any, b: any) => b.score - a.score);

    return reply.send({ scorecard, rendimientoFlotaKmL: rendFlota != null ? Number(rendFlota.toFixed(2)) : null });
  });

  // GET panel de flota: KPIs + alertas activas + cumplimiento de planes
  app.get('/panel', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const en7dias = new Date(ahora.getTime() + 7 * 86400000);

    const [vehiculos, otsAbiertas, otsVencidas, planes, docsVto, multasPend, neumaticos, incidentesMes] = await Promise.all([
      (app.prisma as any).vehiculo.findMany({ where: { tenantId }, select: { id: true, dominio: true, tipo: true, status: true, currentOdometer: true } }),
      (app.prisma as any).workOrder.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } } }),
      (app.prisma as any).workOrder.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { lt: ahora } } }),
      (app.prisma as any).maintenancePlan.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true, nextExecutionDate: true, lastExecutionDate: true } }),
      (app.prisma as any).vencimientoDocumento.findMany({ where: { tenantId, renovado: false, fechaVto: { lte: en7dias } }, select: { id: true, tipo: true, fechaVto: true, vehiculo: { select: { dominio: true } } } }),
      (app.prisma as any).flotaMulta.findMany({ where: { tenantId, estado: 'PENDIENTE' }, select: { id: true, monto: true, tipo: true, vehiculo: { select: { dominio: true } }, conductor: { select: { nombre: true } } } }),
      (app.prisma as any).neumatico.findMany({ where: { tenantId, status: 'EN_USO', profBanda: { not: null } }, select: { id: true, codigo: true, profBanda: true, posiciones: { where: { activo: true }, select: { vehiculo: { select: { dominio: true } } }, take: 1 } } }),
      (app.prisma as any).flotaIncidente.count({ where: { tenantId, createdAt: { gte: inicioMes } } }),
    ]);

    const activos = vehiculos.filter((v: any) => v.status === 'ACTIVO').length;
    const enTaller = vehiculos.filter((v: any) => v.status === 'EN_TALLER').length;
    const disponibilidad = vehiculos.length > 0 ? Math.round((activos / vehiculos.length) * 100) : null;

    // Cumplimiento de planes: % con nextExecutionDate futura o sin fecha (al día)
    const planesVencidos = planes.filter((p: any) => p.nextExecutionDate && new Date(p.nextExecutionDate) < ahora).length;
    const cumplimientoPlanes = planes.length > 0 ? Math.round(((planes.length - planesVencidos) / planes.length) * 100) : null;

    // Alertas activas consolidadas
    const cubiertasCriticas = neumaticos.filter((n: any) => n.profBanda != null && n.profBanda <= 1.6);
    const cubiertasBajas = neumaticos.filter((n: any) => n.profBanda != null && n.profBanda > 1.6 && n.profBanda <= 2.5);
    const alertas = [
      ...cubiertasCriticas.map((n: any) => ({ tipo: 'BANDA_CRITICA', severidad: 'CRITICA', titulo: `Cubierta ${n.codigo} en banda crítica`, detalle: `${n.profBanda} mm — ${n.posiciones?.[0]?.vehiculo?.dominio || 'sin asignar'}`, link: '/flota-360/neumaticos' })),
      ...cubiertasBajas.map((n: any) => ({ tipo: 'BANDA_BAJA', severidad: 'ALTA', titulo: `Cubierta ${n.codigo} con banda baja`, detalle: `${n.profBanda} mm — ${n.posiciones?.[0]?.vehiculo?.dominio || 'sin asignar'}`, link: '/flota-360/neumaticos' })),
      ...docsVto.map((d: any) => ({ tipo: 'DOC_VTO', severidad: new Date(d.fechaVto) < ahora ? 'CRITICA' : 'ALTA', titulo: `${d.tipo} ${new Date(d.fechaVto) < ahora ? 'vencido' : 'por vencer'}`, detalle: `${d.vehiculo?.dominio || ''} — ${new Date(d.fechaVto).toLocaleDateString('es-AR')}`, link: '/flota-360/documentacion' })),
      ...multasPend.map((m: any) => ({ tipo: 'MULTA_PEND', severidad: 'MEDIA', titulo: `Multa pendiente $${m.monto.toLocaleString('es-AR')}`, detalle: `${m.vehiculo?.dominio || ''}${m.conductor?.nombre ? ` — ${m.conductor.nombre}` : ''}`, link: '/flota-360/documentacion' })),
    ];
    const ordenSev: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
    alertas.sort((a, b) => (ordenSev[a.severidad] ?? 9) - (ordenSev[b.severidad] ?? 9));

    return reply.send({
      kpis: {
        totalUnidades: vehiculos.length, activos, enTaller, disponibilidad,
        otsAbiertas, otsVencidas, planesActivos: planes.length, planesVencidos, cumplimientoPlanes,
        multasPendientes: multasPend.length, montoMultasPend: multasPend.reduce((s: number, m: any) => s + m.monto, 0),
        cubiertasCriticas: cubiertasCriticas.length, cubiertasBajas: cubiertasBajas.length,
        incidentesMes, docsPorVencer: docsVto.length,
      },
      alertas,
    });
  });

  // GET panel ejecutivo: TCO tendencia + presupuesto vs real + ranking de unidades
  app.get('/panel-ejecutivo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    // Costo real del mes (combustible + OTs completadas + facturas + multas pagadas)
    const [combustibleMes, otsMes, facturasMes, multasMes, settings] = await Promise.all([
      (app.prisma as any).registroCombustible.aggregate({ where: { tenantId, fecha: { gte: inicioMes } }, _sum: { costoTotal: true } }),
      (app.prisma as any).workOrder.aggregate({ where: { tenantId, status: 'COMPLETED', completedAt: { gte: inicioMes } }, _sum: { totalCost: true } }),
      (app.prisma as any).flotaFactura.aggregate({ where: { tenantId, fecha: { gte: inicioMes } }, _sum: { total: true } }).catch(() => ({ _sum: { total: 0 } })),
      (app.prisma as any).flotaMulta.aggregate({ where: { tenantId, estado: 'PAGADA', pagadaAt: { gte: inicioMes } }, _sum: { monto: true } }).catch(() => ({ _sum: { monto: 0 } })),
      (app.prisma as any).companySettings.findUnique({ where: { tenantId }, select: { flotaPresupuestoMensual: true } }).catch(() => null),
    ]);

    const realMes = (combustibleMes._sum.costoTotal || 0) + (otsMes._sum.totalCost || 0) + (facturasMes._sum.total || 0) + (multasMes._sum.monto || 0);
    const presupuesto = settings?.flotaPresupuestoMensual ?? null;
    const desvioPresupuesto = presupuesto != null && presupuesto > 0 ? Math.round(((realMes - presupuesto) / presupuesto) * 100) : null;

    // Ranking de unidades por costo del mes
    const costosPorVeh = await (app.prisma as any).$queryRaw`
      SELECT v.id, v.dominio, v.tipo,
        COALESCE((SELECT SUM(costo_total) FROM flota_registros_combustible WHERE vehiculo_id = v.id AND fecha >= ${inicioMes}), 0) as combustible,
        COALESCE((SELECT SUM(total) FROM flota_facturas WHERE vehiculo_id = v.id AND fecha >= ${inicioMes}), 0) as facturas
      FROM flota_vehiculos v WHERE v.tenant_id = ${tenantId}
      ORDER BY (combustible + facturas) DESC LIMIT 10
    `.catch(() => []);

    return reply.send({
      mes: ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      costoRealMes: Math.round(realMes),
      desglose: {
        combustible: Math.round(combustibleMes._sum.costoTotal || 0),
        mantenimiento: Math.round(otsMes._sum.totalCost || 0),
        facturas: Math.round(facturasMes._sum.total || 0),
        multas: Math.round(multasMes._sum.monto || 0),
      },
      presupuesto, desvioPresupuesto,
      rankingUnidades: costosPorVeh,
    });
  });

  // PUT presupuesto mensual de flota
  app.put('/config/presupuesto', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({ presupuestoMensual: z.number().nonnegative().nullable() });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const existing = await (app.prisma as any).companySettings.findUnique({ where: { tenantId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'Configuración de empresa no encontrada' });
    await (app.prisma as any).companySettings.update({
      where: { tenantId },
      data: { flotaPresupuestoMensual: body.data.presupuestoMensual },
    });
    return reply.send({ ok: true, presupuestoMensual: body.data.presupuestoMensual });
  });

  console.log('[FLOTA ROUTES] Routes registered including POST /vehiculos/:id/eliminar');
}

// Función auxiliar para verificar planes por KM (ejecutada en background)
async function verificarPlanesPorKm(prisma: any, tenantId: string, vehiculoId: string, odometer: number) {
  // plan.assetId referencia maintenanceAsset.id — resolver desde el vehículo
  const veh = await prisma.vehiculo.findFirst({ where: { id: vehiculoId, tenantId }, select: { maintenanceAssetId: true } });
  if (!veh?.maintenanceAssetId) return;
  const planes = await prisma.maintenancePlan.findMany({
    where: { tenantId, status: 'ACTIVE', frequencyUnit: 'KM', assetId: veh.maintenanceAssetId },
    select: { id: true, triggerKm: true, lastOdometerExecution: true },
  });
  
  for (const plan of planes) {
    const kmDesdeUltima = plan.lastOdometerExecution 
      ? odometer - plan.lastOdometerExecution 
      : odometer;
    const triggerKm = plan.triggerKm || 0;
    
    // Si alcanzó o superó el umbral, actualizar nextExecutionDate para marcar como vencido
    if (kmDesdeUltima >= triggerKm) {
      await prisma.maintenancePlan.updateMany({
        where: { id: plan.id, tenantId },
        data: { nextExecutionDate: new Date() },
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GARANTÍAS DE VEHÍCULOS
// ═══════════════════════════════════════════════════════════════
