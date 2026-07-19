import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

// ═══════════════════════════════════════════════════════════════
// DIGITAL TWIN & INTELIGENCIA PREDICTIVA
// ═══════════════════════════════════════════════════════════════

export default async function digitalTwinRoutes(app: FastifyInstance) {

  // GET /digital-twin/assets/:assetId — Obtener gemelo digital
  app.get('/assets/:assetId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const { assetId } = req.params as any;

    // Buscar o crear twin
    let twin = await (app.prisma as any).assetDigitalTwin.findUnique({
      where: { assetId_tenantId: { assetId, tenantId } },
      include: {
        predictions: {
          where: { validadoAt: null },
          orderBy: { probabilidad: 'desc' },
          take: 10,
        },
        asset: {
          select: {
            id: true, code: true, name: true, category: true,
            currentOdometer: true, totalMaintenanceCost: true,
            lastMaintenanceDate: true, nextMaintenanceDate: true,
            status: true,
          }
        }
      }
    });

    if (!twin) {
      // Crear twin inicial con análisis de datos históricos
      twin = await crearTwinInicial(app.prisma as any, tenantId, assetId);
    }

    return reply.send({ twin });
  });

  // GET /digital-twin/assets/:assetId/predictions — Predicciones de falla
  app.get('/assets/:assetId/predictions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const { assetId } = req.params as any;
    const { severidad, limit = '20' } = req.query as any;

    const where: any = { tenantId, twin: { assetId } };
    if (severidad) where.severidad = severidad;

    const predictions = await (app.prisma as any).assetHealthPrediction.findMany({
      where,
      include: { twin: { include: { asset: { select: { code: true, name: true } } } } },
      orderBy: { probabilidad: 'desc' },
      take: parseInt(limit),
    });

    return reply.send({ predictions, total: predictions.length });
  });

  // POST /digital-twin/analyze — Analizar activo y generar predicciones
  app.post('/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const schema = z.object({
      assetId: z.string().uuid(),
      forzar: z.boolean().default(false), // Forzar re-análisis aunque se haya hecho recientemente
    });

    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const { assetId, forzar } = body.data;

    // Verificar si ya se analizó hoy
    if (!forzar) {
      const ultimaPrediccion = await (app.prisma as any).assetHealthPrediction.findFirst({
        where: { twin: { assetId }, tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (ultimaPrediccion && (new Date().getTime() - new Date(ultimaPrediccion.createdAt).getTime()) < 24 * 60 * 60 * 1000) {
        return reply.send({ mensaje: 'Análisis reciente existe. Use forzar=true para re-analizar.', predicciones: [] });
      }
    }

    // Realizar análisis predictivo
    const resultado = await analizarActivoPredictivo(app.prisma as any, tenantId, assetId);

    return reply.send(resultado);
  });

  // POST /digital-twin/predictions/:id/convert-to-ot — Convertir predicción en OT
  app.post('/predictions/:id/convert-to-ot', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = req.params as any;

    const prediccion = await (app.prisma as any).assetHealthPrediction.findFirst({
      where: { id, tenantId },
      include: { twin: { include: { asset: true } } }
    });

    if (!prediccion) return reply.code(404).send({ error: 'Predicción no encontrada' });
    if (prediccion.workOrderId) return reply.code(400).send({ error: 'Ya tiene OT asociada' });

    const prioridad = prediccion.severidad === 'CRITICA' ? 'CRITICAL' :
                      prediccion.severidad === 'ALTA' ? 'HIGH' : 'MEDIUM';

    const workOrder = await (app.prisma as any).workOrder.create({
      data: {
        code: `OT-PRED-${Date.now().toString().slice(-6)}`,
        title: `Predicción: ${prediccion.componente} - ${prediccion.tipoFalla}`,
        description: `Generado por Inteligencia Predictiva.\n\nComponente: ${prediccion.componente}\nTipo de falla: ${prediccion.tipoFalla}\nProbabilidad: ${prediccion.probabilidad}%\n\nAcción recomendada: ${prediccion.accionRecomendada || 'Revisión técnica'}`,
        type: 'PREDICTIVE',
        priority: prioridad,
        status: 'PENDING',
        assetId: prediccion.twin.assetId,
        tenantId,
        origen: 'PREDICCION',
        origenId: prediccion.id,
      }
    });

    await (app.prisma as any).assetHealthPrediction.update({
      where: { id },
      data: { workOrderId: workOrder.id }
    });

    return reply.send({ workOrder, prediccion });
  });

  // POST /digital-twin/telemetry — Registrar telemetría del activo
  app.post('/telemetry', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const schema = z.object({
      assetId: z.string().uuid(),
      odometro: z.number().optional(),
      horasOperacion: z.number().optional(),
      temperatura: z.number().optional(),
      presionAceite: z.number().optional(),
      vibracion: z.number().optional(),
      eventoTipo: z.string().optional(),
      eventoValor: z.number().optional(),
      conductorId: z.string().optional(),
      condiciones: z.string().optional(),
      observaciones: z.string().optional(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const telemetry = await (app.prisma as any).assetTelemetry.create({
      data: {
        ...body.data,
        tenantId,
        fechaHora: new Date(),
      }
    });

    // Si hay evento crítico, analizar inmediatamente
    if (body.data.eventoTipo?.includes('CRITICO') || body.data.eventoTipo?.includes('ALTA')) {
      setTimeout(() => analizarActivoPredictivo(app.prisma as any, tenantId, body.data.assetId), 0);
    }

    return reply.code(201).send({ telemetry });
  });

  // GET /digital-twin/dashboard — KPIs predictivos del tenant
  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const [
      totalTwins,
      twinsSaludBaja,
      prediccionesCriticas,
      prediccionesAltas,
      prediccionesPendientes,
      promedioHealthScore,
      activosEnRiesgo,
    ] = await Promise.all([
      (app.prisma as any).assetDigitalTwin.count({ where: { tenantId } }),
      (app.prisma as any).assetDigitalTwin.count({ where: { tenantId, healthScore: { lt: 50 } } }),
      (app.prisma as any).assetHealthPrediction.count({ where: { tenantId, severidad: 'CRITICA', validadoAt: null } }),
      (app.prisma as any).assetHealthPrediction.count({ where: { tenantId, severidad: 'ALTA', validadoAt: null } }),
      (app.prisma as any).assetHealthPrediction.count({ where: { tenantId, validadoAt: null, workOrderId: null } }),
      (app.prisma as any).assetDigitalTwin.aggregate({ where: { tenantId }, _avg: { healthScore: true } }),
      (app.prisma as any).assetDigitalTwin.count({ where: { tenantId, riskScore: { gt: 70 } } }),
    ]);

    // Top 5 activos en riesgo
    const activosCriticos = await (app.prisma as any).assetDigitalTwin.findMany({
      where: { tenantId, OR: [{ healthScore: { lt: 60 } }, { riskScore: { gt: 60 } }] },
      include: { asset: { select: { code: true, name: true, category: true } }, predictions: { where: { validadoAt: null }, take: 3 } },
      orderBy: [{ riskScore: 'desc' }, { healthScore: 'asc' }],
      take: 5,
    });

    return reply.send({
      kpis: {
        totalTwins,
        twinsSaludBaja,
        prediccionesCriticas,
        prediccionesAltas,
        prediccionesPendientes,
        promedioHealthScore: Math.round(promedioHealthScore._avg.healthScore || 100),
        activosEnRiesgo,
      },
      activosCriticos,
    });
  });

  // POST /digital-twin/simulate — Simulación de escenarios por km adicionales
  app.post('/simulate', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const schema = z.object({
      assetId: z.string().uuid(),
      escenarios: z.array(z.number().positive()).min(1).max(5),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const { assetId, escenarios } = body.data;

    // Fetch asset with full maintenance context
    const [asset, vehiculo, maintenancePlans] = await Promise.all([
      (app.prisma as any).maintenanceAsset.findFirst({
        where: { id: assetId, tenantId },
        include: {
          workOrders: {
            orderBy: { completedAt: 'desc' },
            take: 30,
            select: {
              title: true, type: true, priority: true, status: true,
              totalCost: true, laborCost: true, partsCost: true,
              completedAt: true, scheduledDate: true,
              vehiculoHistorial: {
                select: { odometro: true, fecha: true, tipo: true, descripcion: true },
                take: 1,
              },
            },
          },
          costs: {
            orderBy: { date: 'desc' },
            take: 30,
            select: { costType: true, amount: true, description: true, date: true },
          },
        },
      }),
      // Get linked vehicle for additional historial
      (app.prisma as any).vehiculo.findFirst({
        where: { maintenanceAssetId: assetId, tenantId },
        select: {
          currentOdometer: true,
          historialMantenimiento: {
            orderBy: { odometro: 'desc' },
            take: 30,
            select: { odometro: true, fecha: true, tipo: true, descripcion: true, costo: true },
          },
        },
      }).catch(() => null),
      (app.prisma as any).maintenancePlan.findMany({
        where: { assetId, tenantId, status: 'ACTIVE' },
        select: {
          name: true, frequencyUnit: true, frequencyValue: true,
          triggerKm: true, lastOdometerExecution: true, nextExecutionDate: true,
        },
        take: 10,
      }).catch(() => []),
    ]);

    if (!asset) return reply.code(404).send({ error: 'Activo no encontrado' });

    const odometroActual = vehiculo?.currentOdometer ?? asset.currentOdometer ?? 0;

    // Build enriched maintenance timeline with km readings
    const historialConKm: { km: number | null; fecha: string; tipo: string; descripcion: string; costo: number }[] = [];

    // From vehicle historial (most reliable km data)
    if (vehiculo?.historialMantenimiento?.length) {
      for (const h of vehiculo.historialMantenimiento) {
        historialConKm.push({ km: h.odometro ?? null, fecha: h.fecha ? new Date(h.fecha).toLocaleDateString('es-AR') : '—', tipo: h.tipo, descripcion: h.descripcion, costo: h.costo || 0 });
      }
    }

    // From work orders vehiculoHistorial
    for (const o of asset.workOrders) {
      if (o.vehiculoHistorial?.[0]?.odometro) {
        const h = o.vehiculoHistorial[0];
        if (!historialConKm.find(x => x.descripcion === o.title)) {
          historialConKm.push({ km: h.odometro, fecha: o.completedAt ? new Date(o.completedAt).toLocaleDateString('es-AR') : '—', tipo: o.type, descripcion: o.title, costo: (o.laborCost || 0) + (o.partsCost || 0) || o.totalCost || 0 });
        }
      }
    }

    // Sort by km descending
    historialConKm.sort((a, b) => (b.km ?? 0) - (a.km ?? 0));

    // Work orders without km (fallback)
    const otsSinKm = asset.workOrders.filter(
      (o: any) => !o.vehiculoHistorial?.[0]?.odometro
    );

    const costoPromOT = asset.workOrders.length > 0
      ? asset.workOrders.reduce((s: number, o: any) => s + ((o.laborCost || 0) + (o.partsCost || 0) || o.totalCost || 0), 0) / asset.workOrders.length
      : 0;

    // Build human-readable maintenance timeline
    const lineaDeVida = historialConKm.slice(0, 15).map(h =>
      `  • [${h.km != null ? `${h.km.toLocaleString()} km` : 'km desconocido'}] ${h.fecha} — ${h.tipo}: ${h.descripcion} ($${h.costo.toLocaleString()})`
    ).join('\n');

    const otsSinKmResumen = otsSinKm.slice(0, 8).map((o: any) => {
      const costo = (o.laborCost || 0) + (o.partsCost || 0) || o.totalCost || 0;
      return `  • ${o.completedAt ? new Date(o.completedAt).toLocaleDateString('es-AR') : 'pendiente'} — ${o.type}: ${o.title} ($${costo.toLocaleString()})`;
    }).join('\n');

    const planesResumen = (maintenancePlans as any[]).map((p: any) =>
      `  • ${p.name}: cada ${p.frequencyValue} ${p.frequencyUnit === 'KM' ? 'km' : 'días'}${p.triggerKm ? ` (umbral: ${p.triggerKm.toLocaleString()} km)` : ''}${p.lastOdometerExecution ? ` — último a ${p.lastOdometerExecution.toLocaleString()} km` : ''}`
    ).join('\n');

    const prompt = `Sos un ingeniero experto en mantenimiento predictivo de vehículos industriales y flotas de camiones y autoelevadores.

ACTIVO: ${asset.name} (${asset.code}) — Categoría: ${asset.category}
Odómetro actual: ${odometroActual.toLocaleString()} km
Total OTs históricas: ${asset.workOrders.length}
Costo promedio por intervención: $${Math.round(costoPromOT).toLocaleString()}

HISTORIAL DE MANTENIMIENTO CON ODÓMETRO (ordenado por km):
${lineaDeVida || 'Sin historial con km registrado'}

INTERVENCIONES SIN ODÓMETRO REGISTRADO:
${otsSinKmResumen || 'Ninguna'}

PLANES DE MANTENIMIENTO ACTIVOS:
${planesResumen || 'Sin planes activos'}

ESCENARIOS A PROYECTAR (km adicionales sobre el odómetro actual):
${escenarios.map((km: number) => `- +${km.toLocaleString()} km → total: ${(odometroActual + km).toLocaleString()} km`).join('\n')}

Para CADA escenario proyectá el estado y necesidad de intervención de estos componentes específicos:
- NEUMÁTICOS: desgaste de banda, profundidad estimada remanente, probabilidad de cambio
- ACEITE DE MOTOR: nivel de degradación, necesidad de cambio
- FILTROS: filtro de aceite, filtro de combustible, filtro de aire, filtro hidráulico
- FRENOS: desgaste de pastillas/zapatas, líquido de frenos
- CORREAS Y CADENAS: correa de distribución, correa serpentina, cadena de transmisión
- SISTEMA DE REFRIGERACIÓN: anticongelante, termostato, bomba de agua
- BATERÍA Y SISTEMA ELÉCTRICO: carga, bornes, alternador
- AMORTIGUADORES Y SUSPENSIÓN: estado estimado
- SISTEMA DE DIRECCIÓN: fluido, desgaste de componentes
- EMBRAGUE/TRANSMISIÓN: estado estimado

Para cada componente indicá: estado esperado (OK / ATENCIÓN / CAMBIO PRÓXIMO / CAMBIO URGENTE) y acción recomendada.

Respondé SOLO con JSON válido, sin texto adicional, con esta estructura exacta:
{
  "escenarios": [
    {
      "kmAdicionales": 10000,
      "odometroTotal": 50000,
      "nivelRiesgo": "MEDIO",
      "riesgos": ["riesgo principal 1", "riesgo principal 2"],
      "mantenimientos": ["acción preventiva 1", "acción preventiva 2"],
      "costoEstimado": 150000,
      "accionPrioritaria": "texto de la acción más urgente",
      "componentes": [
        { "nombre": "Neumáticos", "estado": "ATENCIÓN", "detalle": "desgaste estimado al 60%, revisar profundidad de banda", "icono": "🛞" },
        { "nombre": "Aceite de motor", "estado": "CAMBIO PRÓXIMO", "detalle": "supera intervalo recomendado de 10.000 km", "icono": "🛢️" },
        { "nombre": "Filtro de aceite", "estado": "CAMBIO PRÓXIMO", "detalle": "cambiar junto con aceite de motor", "icono": "🔧" },
        { "nombre": "Filtro de combustible", "estado": "OK", "detalle": "en buen estado, próximo cambio en 5.000 km", "icono": "⛽" },
        { "nombre": "Filtro de aire", "estado": "ATENCIÓN", "detalle": "verificar obstrucción", "icono": "💨" },
        { "nombre": "Frenos", "estado": "OK", "detalle": "pastillas con vida útil estimada al 70%", "icono": "🛑" },
        { "nombre": "Correa de distribución", "estado": "OK", "detalle": "dentro del intervalo de reemplazo", "icono": "⚙️" },
        { "nombre": "Sistema de refrigeración", "estado": "OK", "detalle": "verificar nivel de anticongelante", "icono": "🌡️" },
        { "nombre": "Batería", "estado": "ATENCIÓN", "detalle": "verificar carga y bornes", "icono": "🔋" },
        { "nombre": "Amortiguadores", "estado": "OK", "detalle": "sin signos de deterioro estimados", "icono": "🔩" }
      ]
    }
  ],
  "resumenGeneral": "texto de 2-3 oraciones con la proyección general del activo"
}`;

    try {
      const llm = createGroqOnlyLLMProvider((req as any).tenant, app.prisma, tenantId, (req as any).auth?.userId ?? null, 'digital-twin-simulate');
      const response = await llm.chat([{ role: 'user', content: prompt }], 2000);

      let parsed: any;
      try {
        const text = response.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch { parsed = null; }

      if (!parsed) {
        return reply.send({
          escenarios: escenarios.map((km: number) => ({
            kmAdicionales: km,
            odometroTotal: odometroActual + km,
            nivelRiesgo: km > 20000 ? 'ALTO' : 'MEDIO',
            riesgos: ['Desgaste acumulado de componentes', 'Revisión de frenos y neumáticos recomendada'],
            mantenimientos: ['Service preventivo', 'Revisión de fluidos'],
            costoEstimado: Math.round(costoPromOT * (km / 10000)),
            accionPrioritaria: 'Programar service preventivo',
          })),
          resumenGeneral: 'Proyección estimada basada en historial del activo.',
        });
      }

      return reply.send(parsed);
    } catch (err: any) {
      app.log.error(err, 'Error en simulación digital twin');
      return reply.code(503).send({ error: 'IA no disponible. Intentá nuevamente.' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════

async function crearTwinInicial(prisma: any, tenantId: string, assetId: string) {
  // Obtener datos históricos del activo
  const asset = await prisma.maintenanceAsset.findFirst({
    where: { id: assetId, tenantId },
    include: {
      workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      costs: true,
    }
  });

  if (!asset) throw new Error('Activo no encontrado');

  // Calcular health score inicial basado en historial
  const otsRecientes = asset.workOrders.length;
  const costoTotal = asset.totalMaintenanceCost || 0;
  const ultimaFecha = asset.lastMaintenanceDate;
  const diasSinMantenimiento = ultimaFecha ? Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / (1000 * 60 * 60 * 24)) : 365;

  // Fórmula simplificada de salud
  let healthScore = 100;
  healthScore -= Math.min(30, otsRecientes * 3); // -3% por cada OT reciente
  healthScore -= Math.min(20, diasSinMantenimiento / 10); // -1% cada 10 días sin mantenimiento
  healthScore -= Math.min(20, costoTotal / 50000); // -1% cada $50k en costos
  healthScore = Math.max(10, Math.min(100, healthScore));

  // Componentes genéricos basados en categoría
  const componentes = generarComponentesPorCategoria(asset.category, healthScore);

  const twin = await prisma.assetDigitalTwin.create({
    data: {
      tenantId,
      assetId,
      healthScore,
      riskScore: 100 - healthScore,
      componentes: JSON.stringify(componentes),
      syncSource: 'AUTO',
    },
    include: { asset: true }
  });

  return { ...twin, predictions: [] };
}

function generarComponentesPorCategoria(categoria: string, healthScore: number) {
  const baseRiesgo = 100 - healthScore;
  const componentes: any = {};

  if (categoria === 'VEHICLE' || categoria === 'CAMION' || categoria === 'TRACTOR') {
    componentes.motor = { salud: healthScore, riesgo: baseRiesgo * 0.8, kmRestantes: Math.floor(healthScore * 500) };
    componentes.frenos = { salud: Math.max(0, healthScore - 10), riesgo: baseRiesgo * 1.2, kmRestantes: Math.floor((healthScore - 10) * 300) };
    componentes.caja = { salud: Math.max(0, healthScore - 5), riesgo: baseRiesgo * 0.9, kmRestantes: Math.floor((healthScore - 5) * 400) };
    componentes.diferencial = { salud: Math.max(0, healthScore - 8), riesgo: baseRiesgo, kmRestantes: Math.floor((healthScore - 8) * 350) };
    componentes.neumaticos = { salud: Math.max(0, healthScore - 15), riesgo: baseRiesgo * 1.3, kmRestantes: Math.floor((healthScore - 15) * 250) };
  } else if (categoria === 'MACHINERY' || categoria === 'MAQUINARIA') {
    componentes.motor = { salud: healthScore, riesgo: baseRiesgo * 0.8, horasRestantes: Math.floor(healthScore * 20) };
    componentes.hidraulico = { salud: Math.max(0, healthScore - 12), riesgo: baseRiesgo * 1.1, horasRestantes: Math.floor((healthScore - 12) * 15) };
    componentes.electrico = { salud: Math.max(0, healthScore - 8), riesgo: baseRiesgo * 0.9, horasRestantes: Math.floor((healthScore - 8) * 25) };
    componentes.transmision = { salud: Math.max(0, healthScore - 10), riesgo: baseRiesgo, horasRestantes: Math.floor((healthScore - 10) * 18) };
  } else {
    componentes.principal = { salud: healthScore, riesgo: baseRiesgo, diasRestantes: Math.floor(healthScore * 2) };
    componentes.secundario = { salud: Math.max(0, healthScore - 10), riesgo: baseRiesgo * 1.1, diasRestantes: Math.floor((healthScore - 10) * 1.8) };
  }

  return componentes;
}

async function analizarActivoPredictivo(prisma: any, tenantId: string, assetId: string) {
  // Obtener twin
  let twin = await prisma.assetDigitalTwin.findUnique({
    where: { assetId_tenantId: { assetId, tenantId } },
    include: { asset: true, telemetry: { orderBy: { fechaHora: 'desc' }, take: 20 } }
  });

  if (!twin) {
    twin = await crearTwinInicial(prisma, tenantId, assetId);
  }

  // Análisis de datos para generar predicciones
  const predicciones: any[] = [];

  // 1. Analizar telemetría reciente
  const telemetry = twin.telemetry || [];
  const tempAlta = telemetry.filter((t: any) => t.temperatura > 100).length;
  const presionBaja = telemetry.filter((t: any) => t.presionAceite < 20).length;
  const vibracionAlta = telemetry.filter((t: any) => t.vibracion > 5).length;

  // 2. Analizar historial de fallas
  const historialFallas = await prisma.workOrder.findMany({
    where: { assetId, tenantId, type: 'CORRECTIVE', status: 'COMPLETED' },
    orderBy: { completedDate: 'desc' },
    take: 5,
  });

  // Generar predicciones basadas en patrones
  if (tempAlta >= 2) {
    predicciones.push({
      twinId: twin.id,
      tenantId,
      componente: 'motor',
      tipoFalla: 'sobrecalentamiento',
      probabilidad: Math.min(95, 60 + tempAlta * 10),
      diasEstimados: 7,
      severidad: tempAlta >= 3 ? 'CRITICA' : 'ALTA',
      accionRecomendada: 'Revisar sistema de refrigeración. Verificar nivel de coolant y estado del radiador.',
    });
  }

  if (presionBaja >= 2) {
    predicciones.push({
      twinId: twin.id,
      tenantId,
      componente: 'motor',
      tipoFalla: 'desgaste_bomba_aceite',
      probabilidad: Math.min(90, 55 + presionBaja * 12),
      diasEstimados: 14,
      severidad: 'ALTA',
      accionRecomendada: 'Revisar presión de aceite del motor. Posible desgaste de bomba o rodamientos.',
    });
  }

  if (vibracionAlta >= 2) {
    predicciones.push({
      twinId: twin.id,
      tenantId,
      componente: 'transmision',
      tipoFalla: 'desbalance',
      probabilidad: Math.min(85, 50 + vibracionAlta * 8),
      diasEstimados: 21,
      severidad: 'MEDIA',
      accionRecomendada: 'Verificar alineación y balanceo de componentes rotativos.',
    });
  }

  // Analizar patrón de fallas recurrentes
  const fallasFrecuentes = historialFallas.reduce((acc: any, ot: any) => {
    const key = ot.title?.toLowerCase() || '';
    if (key.includes('freno')) acc.frenos = (acc.frenos || 0) + 1;
    if (key.includes('motor')) acc.motor = (acc.motor || 0) + 1;
    if (key.includes('caja') || key.includes('transmision')) acc.caja = (acc.caja || 0) + 1;
    if (key.includes('neumatico')) acc.neumaticos = (acc.neumaticos || 0) + 1;
    return acc;
  }, {});

  // Generar predicciones por patrones históricos
  if (fallasFrecuentes.frenos >= 2) {
    predicciones.push({
      twinId: twin.id,
      tenantId,
      componente: 'frenos',
      tipoFalla: 'desgaste_prematuro',
      probabilidad: 70,
      diasEstimados: 30,
      severidad: 'MEDIA',
      accionRecomendada: 'Patrón de fallas en frenos detectado. Revisar sistema completo y pastillas.',
    });
  }

  // Guardar predicciones
  const creadas = [];
  for (const pred of predicciones) {
    const existente = await prisma.assetHealthPrediction.findFirst({
      where: {
        twinId: pred.twinId,
        componente: pred.componente,
        tipoFalla: pred.tipoFalla,
        validadoAt: null,
      }
    });
    if (!existente) {
      const creada = await prisma.assetHealthPrediction.create({ data: pred });
      creadas.push(creada);
    }
  }

  // Actualizar twin con nuevo análisis
  await prisma.assetDigitalTwin.update({
    where: { id: twin.id },
    data: {
      healthScore: Math.max(10, 100 - predicciones.length * 15),
      riskScore: Math.min(100, predicciones.length * 20),
      lastSyncAt: new Date(),
    }
  });

  return {
    mensaje: `Análisis completado. ${creadas.length} nuevas predicciones generadas.`,
    twinId: twin.id,
    predicciones: creadas,
    estadisticas: {
      temperaturasAltas: tempAlta,
      presionesBajas: presionBaja,
      vibracionesAltas: vibracionAlta,
      fallasHistoricas: Object.keys(fallasFrecuentes).length,
    }
  };
}
