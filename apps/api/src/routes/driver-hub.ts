import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { notifyIncidenteReportado, notifyFlotaAlerta } from '../services/notifyService.js';
import { syncOdometroYDesgaste } from '../services/fleetTires.js';
import { existsSync, mkdirSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Driver Hub — Hub público del chofer vía QR de la unidad.
 *
 * Reutiliza el token de MaintenanceInterventionQR (el sticker QR del camión).
 * El chofer escanea y accede a: checklist pre-viaje, reporte de incidentes,
 * carga de combustible, registros de servicio/bitácora y documentación.
 *
 * Rutas públicas (sin auth, identifican la unidad por token):
 *   GET  /driver-hub/public/:token              → datos del hub
 *   GET  /driver-hub/public/:token/documentos   → docs generales + de la unidad + vencimientos
 *   POST /driver-hub/public/:token/incidente    → reportar incidente/accidente/evento
 *   POST /driver-hub/public/:token/combustible  → reportar carga (litros o $)
 *   POST /driver-hub/public/:token/servicio     → inicio/fin de servicio + bitácora
 *   POST /driver-hub/public/:token/upload       → subir foto (ticket, evidencia)
 *
 * Rutas autenticadas (empresa):
 *   GET    /driver-hub/documentos               → listar documentos del chofer
 *   POST   /driver-hub/documentos/upload        → subir PDF
 *   POST   /driver-hub/documentos               → crear registro de documento
 *   DELETE /driver-hub/documentos/:id           → eliminar documento
 *   GET    /driver-hub/incidentes               → listar incidentes reportados
 *   PATCH  /driver-hub/incidentes/:id           → cambiar estado del incidente
 *   GET    /driver-hub/servicios                → listar registros de servicio/bitácora
 */

const TIPOS_INCIDENTE: Record<string, string> = {
  ACCIDENTE_TRANSITO: 'Accidente de tránsito',
  LESION_PERSONAL: 'Lesión personal',
  ROBO_HURTO: 'Robo / hurto',
  PROBLEMA_CARGA: 'Problema con la carga',
  CONTROL_TRANSITO: 'Control de tránsito / multa',
  DEMORA: 'Demora en carga/descarga',
  OTRO: 'Otro evento',
};

// Resuelve el QR + vehículo asociado al token público
async function resolveHubContext(prisma: any, token: string) {
  const qr = await prisma.maintenanceInterventionQR.findFirst({
    where: { token, isActive: true },
    include: { maintenanceAsset: true },
  });
  if (!qr) return null;
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { maintenanceAssetId: qr.maintenanceAssetId, tenantId: qr.tenantId },
    include: { conductor: { select: { id: true, nombre: true } } },
  });
  return { qr, asset: qr.maintenanceAsset, vehiculo };
}

export async function driverHubRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma as any;

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — datos del hub
  // ════════════════════════════════════════════════════════════════════════
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, asset, vehiculo } = ctx;

    // Checklist pre-viaje: QR de inspección vinculado al mismo activo
    const inspeccionQR = await prisma().inspeccionQR.findFirst({
      where: { maintenanceAssetId: asset.id, tenantId: qr.tenantId, isActive: true },
      select: { token: true, titulo: true },
    });

    // Branding de la empresa
    let empresa: any = null;
    try {
      const s = await prisma().companySettings.findUnique({
        where: { tenantId: qr.tenantId },
        select: { companyName: true, logoUrl: true, primaryColor: true },
      });
      empresa = s;
    } catch { /* sin branding */ }

    // Choferes activos para el selector (identidad fuerte en registros)
    const choferes = await prisma().conductor.findMany({
      where: { tenantId: qr.tenantId, status: 'ACTIVO' },
      select: { id: true, nombre: true, licenciaVto: true, psicofisicoVto: true },
      orderBy: { nombre: 'asc' },
    }).catch(() => []);

    return reply.send({
      activo: {
        nombre: qr.activoNombre,
        codigo: qr.activoCodigo,
        tipo: asset.tipo || null,
      },
      vehiculo: vehiculo ? {
        id: vehiculo.id,
        dominio: vehiculo.dominio,
        tipo: vehiculo.tipo,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        currentOdometer: vehiculo.currentOdometer,
        tipoCombustible: vehiculo.tipoCombustible || 'DIESEL',
        conductor: vehiculo.conductor?.nombre || null,
      } : null,
      checklistUrl: inspeccionQR ? `/inspeccionar/${inspeccionQR.token}` : null,
      intervencionUrl: `/mantenimiento-qr/${token}`,
      choferes,
      empresa: empresa ? {
        nombre: empresa.companyName,
        logo: empresa.logoUrl,
        color: empresa.primaryColor || '#2563EB',
      } : null,
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — documentos visibles para el chofer
  // ════════════════════════════════════════════════════════════════════════
  app.get('/public/:token/documentos', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;

    // Documentos generales (vehiculoId null) + específicos de la unidad
    const documentos = await prisma().flotaDocumento.findMany({
      where: {
        tenantId: qr.tenantId,
        OR: [
          { vehiculoId: null },
          ...(vehiculo ? [{ vehiculoId: vehiculo.id }] : []),
        ],
      },
      orderBy: [{ categoria: 'asc' }, { createdAt: 'desc' }],
    });

    // Vencimientos de la unidad (VTV, seguro, habilitación…) — documentación propia
    const vencimientos = vehiculo
      ? await prisma().vencimientoDocumento.findMany({
          where: { vehiculoId: vehiculo.id, tenantId: qr.tenantId },
          orderBy: { fechaVto: 'asc' },
        })
      : [];

    return reply.send({ documentos, vencimientos });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — reportar incidente / accidente / evento en ruta
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/incidente', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;
    if (!vehiculo) return reply.code(400).send({ error: 'La unidad no está vinculada a un vehículo de flota' });

    const schema = z.object({
      tipo: z.enum(['ACCIDENTE_TRANSITO', 'LESION_PERSONAL', 'ROBO_HURTO', 'PROBLEMA_CARGA', 'CONTROL_TRANSITO', 'DEMORA', 'OTRO']),
      gravedad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
      descripcion: z.string().max(2000).optional(),
      hayLesionados: z.boolean().default(false),
      lesionadosDetalle: z.string().max(1000).optional(),
      tercerosInvolucrados: z.string().max(1000).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      ubicacionTexto: z.string().max(300).optional(),
      odometro: z.number().positive().optional(),
      fotos: z.array(z.object({ url: z.string() })).optional(),
      reportadoPorNombre: z.string().min(1).max(200),
      reportadoPorTelefono: z.string().max(50).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const incidente = await prisma().flotaIncidente.create({
      data: {
        tenantId: qr.tenantId,
        vehiculoId: vehiculo.id,
        tipo: body.data.tipo,
        gravedad: body.data.gravedad,
        descripcion: body.data.descripcion || null,
        hayLesionados: body.data.hayLesionados,
        lesionadosDetalle: body.data.lesionadosDetalle || null,
        tercerosInvolucrados: body.data.tercerosInvolucrados || null,
        lat: body.data.lat ?? null,
        lng: body.data.lng ?? null,
        ubicacionTexto: body.data.ubicacionTexto || null,
        odometro: body.data.odometro ?? null,
        fotos: body.data.fotos ?? null,
        reportadoPorNombre: body.data.reportadoPorNombre,
        reportadoPorTelefono: body.data.reportadoPorTelefono || null,
      },
    });

    // Sync odómetro si viene (+ desgaste de cubiertas y propagación al acoplado)
    if (body.data.odometro && (vehiculo.currentOdometer == null || body.data.odometro > vehiculo.currentOdometer)) {
      await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, body.data.odometro).catch(() => {});
    }

    // Notificar a admins
    notifyIncidenteReportado(prisma(), {
      tenantId: qr.tenantId,
      vehiculoDominio: vehiculo.dominio,
      tipoLabel: TIPOS_INCIDENTE[body.data.tipo] || body.data.tipo,
      gravedad: body.data.gravedad,
      reportadoPorNombre: body.data.reportadoPorNombre,
      hayLesionados: body.data.hayLesionados,
      ubicacionTexto: body.data.ubicacionTexto,
      incidenteId: incidente.id,
    }).catch((e: any) => console.error('[driver-hub] notify incidente:', e));

    return reply.code(201).send({
      ok: true,
      incidenteId: incidente.id,
      mensaje: 'Incidente registrado. La empresa ya fue notificada.',
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — reportar carga de combustible (litros o monto)
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/combustible', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;
    if (!vehiculo) return reply.code(400).send({ error: 'La unidad no está vinculada a un vehículo de flota' });

    const schema = z.object({
      litros: z.number().positive().optional(),
      montoTotal: z.number().positive().optional(), // plata gastada (alternativa a litros)
      precioPorLitro: z.number().positive().optional(),
      odometro: z.number().positive().optional(),
      estacion: z.string().max(200).optional(),
      tipoCombustible: z.enum(['DIESEL', 'NAFTA', 'GNC']).default('DIESEL'),
      litrosUrea: z.number().nonnegative().optional(),
      fotoTicket: z.string().optional(), // url de la foto del ticket/surtidor
      conductorId: z.string().uuid().optional(),
      reportadoPorNombre: z.string().min(1).max(200),
      notas: z.string().max(500).optional(),
    }).refine(d => d.litros != null || d.montoTotal != null, { message: 'Indicá litros o el monto gastado' });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Derivar litros si solo vino monto + precio
    let litros = body.data.litros ?? null;
    if (litros == null && body.data.montoTotal && body.data.precioPorLitro) {
      litros = Math.round((body.data.montoTotal / body.data.precioPorLitro) * 100) / 100;
    }
    const costoTotal = body.data.montoTotal
      ?? (litros != null && body.data.precioPorLitro ? Math.round(litros * body.data.precioPorLitro * 100) / 100 : null);

    // Rendimiento vs carga anterior DEL MISMO TIPO (solo si hay litros + odómetro).
    // Sin el filtro, una carga GNC (m³) compararía contra una carga diésel (L).
    let rendimiento: number | null = null;
    if (litros != null && litros > 0 && body.data.odometro) {
      const anterior = await prisma().registroCombustible.findFirst({
        where: { vehiculoId: vehiculo.id, tenantId: qr.tenantId, odometro: { not: null }, tipoCombustible: body.data.tipoCombustible },
        orderBy: { fecha: 'desc' },
      });
      if (anterior?.odometro && body.data.odometro > anterior.odometro) {
        rendimiento = Math.round(((body.data.odometro - anterior.odometro) / litros) * 100) / 100;
      }
    }

    const notasParts = [
      body.data.notas,
      body.data.fotoTicket ? `Ticket: ${body.data.fotoTicket}` : null,
      `Reportado por ${body.data.reportadoPorNombre} vía QR`,
    ].filter(Boolean);

    const registro = await prisma().registroCombustible.create({
      data: {
        tenantId: qr.tenantId,
        vehiculoId: vehiculo.id,
        conductorId: body.data.conductorId ?? vehiculo.conductor?.id ?? null,
        litros,
        precioPorLitro: body.data.precioPorLitro ?? null,
        costoTotal,
        odometro: body.data.odometro ?? null,
        rendimiento,
        estacion: body.data.estacion || null,
        tipoCombustible: body.data.tipoCombustible,
        litrosUrea: body.data.litrosUrea ?? null,
        notas: notasParts.join(' · '),
      },
    });

    // Sync odómetro al vehículo + activo de mantenimiento (+ desgaste de cubiertas y acoplado)
    if (body.data.odometro && (vehiculo.currentOdometer == null || body.data.odometro > vehiculo.currentOdometer)) {
      await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, body.data.odometro).catch(() => {});
      await prisma().maintenanceAsset.update({ where: { id: qr.maintenanceAssetId }, data: { currentOdometer: body.data.odometro } }).catch(() => {});
    }

    return reply.code(201).send({
      ok: true,
      registroId: registro.id,
      litrosRegistrados: litros,
      rendimiento,
      mensaje: 'Carga registrada correctamente.',
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — registro de servicio (inicio/fin) y bitácora
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/servicio', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;
    if (!vehiculo) return reply.code(400).send({ error: 'La unidad no está vinculada a un vehículo de flota' });

    const schema = z.object({
      tipo: z.enum(['INICIO_SERVICIO', 'FIN_SERVICIO', 'BITACORA']),
      odometro: z.number().positive().optional(),
      notas: z.string().max(2000).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      fotos: z.array(z.object({ url: z.string() })).optional(),
      origen: z.string().max(200).optional(),
      destino: z.string().max(200).optional(),
      carga: z.string().max(300).optional(),
      conductorId: z.string().uuid().optional(),
      reportadoPorNombre: z.string().min(1).max(200),
      reportadoPorTelefono: z.string().max(50).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;
    const ahora = new Date();
    const nombre = d.reportadoPorNombre.trim();

    // Filtro de chofer: por conductorId (fuerte) o por nombre (fallback/legacy)
    const filtroChofer: any = d.conductorId
      ? { OR: [{ conductorId: d.conductorId }, { reportadoPorNombre: { equals: nombre, mode: 'insensitive' } }] }
      : { reportadoPorNombre: { equals: nombre, mode: 'insensitive' } };

    // ── Jornada y descanso automáticos ──
    let horasDescanso: number | null = null;
    let descansoInsuficiente = false;
    let horasTrabajadas: number | null = null;
    let jornadaExcesiva = false;

    if (d.tipo === 'INICIO_SERVICIO') {
      // Último FIN de servicio del MISMO chofer
      const ultimoFin = await prisma().servicioRegistro.findFirst({
        where: { tenantId: qr.tenantId, tipo: 'FIN_SERVICIO', ...filtroChofer },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (ultimoFin) {
        horasDescanso = Math.round(((ahora.getTime() - ultimoFin.createdAt.getTime()) / 3600000) * 10) / 10;
        descansoInsuficiente = horasDescanso < 12;
      }
    } else if (d.tipo === 'FIN_SERVICIO') {
      // INICIO correspondiente: último INICIO del mismo chofer en esta unidad;
      // si no hay, último INICIO de la unidad (por si arrancó otro chofer)
      const ultimoInicio = await prisma().servicioRegistro.findFirst({
        where: { tenantId: qr.tenantId, vehiculoId: vehiculo.id, tipo: 'INICIO_SERVICIO', ...filtroChofer },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }) ?? await prisma().servicioRegistro.findFirst({
        where: { tenantId: qr.tenantId, vehiculoId: vehiculo.id, tipo: 'INICIO_SERVICIO' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (ultimoInicio && ultimoInicio.createdAt < ahora) {
        horasTrabajadas = Math.round(((ahora.getTime() - ultimoInicio.createdAt.getTime()) / 3600000) * 10) / 10;
        jornadaExcesiva = horasTrabajadas > 12;
      }
    }

    // Odómetro sospechoso: salto >2000km vs. el valor actual de la unidad
    const odometroSospechoso = !!(d.odometro && vehiculo.currentOdometer != null && (d.odometro - vehiculo.currentOdometer) > 2000);

    const registro = await prisma().servicioRegistro.create({
      data: {
        tenantId: qr.tenantId,
        vehiculoId: vehiculo.id,
        tipo: d.tipo,
        odometro: d.odometro ?? null,
        notas: d.notas || null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        fotos: d.fotos ?? null,
        horasDescanso,
        horasTrabajadas,
        descansoInsuficiente,
        jornadaExcesiva,
        odometroSospechoso,
        origen: d.tipo === 'INICIO_SERVICIO' ? (d.origen || null) : null,
        destino: d.tipo === 'INICIO_SERVICIO' ? (d.destino || null) : null,
        carga: d.tipo === 'INICIO_SERVICIO' ? (d.carga || null) : null,
        conductorId: d.conductorId || null,
        reportadoPorNombre: nombre,
        reportadoPorTelefono: d.reportadoPorTelefono || null,
      },
    });

    // Sync odómetro al vehículo + activo (+ desgaste de cubiertas y acoplado)
    if (d.odometro && (vehiculo.currentOdometer == null || d.odometro > vehiculo.currentOdometer)) {
      await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, d.odometro).catch(() => {});
      await prisma().maintenanceAsset.update({ where: { id: qr.maintenanceAssetId }, data: { currentOdometer: d.odometro } }).catch(() => {});
    }

    // Notificar a admins eventos de seguridad vial
    if (descansoInsuficiente) {
      notifyFlotaAlerta(prisma(), {
        tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
        titulo: 'Descanso insuficiente al tomar servicio',
        detalle: `inició servicio con solo <strong>${horasDescanso}h</strong> de descanso (mínimo recomendado 12h).`,
        reportadoPorNombre: nombre, link: '/flota-360/documentacion?tab=bitacora',
        entityType: 'servicio_registro', entityId: registro.id,
      }).catch((e: any) => console.error('[driver-hub] notify descanso:', e));
    }
    if (jornadaExcesiva) {
      notifyFlotaAlerta(prisma(), {
        tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
        titulo: 'Jornada excesiva',
        detalle: `cerró servicio con una jornada de <strong>${horasTrabajadas}h</strong> (supera las 12h).`,
        reportadoPorNombre: nombre, link: '/flota-360/documentacion?tab=bitacora',
        entityType: 'servicio_registro', entityId: registro.id,
      }).catch((e: any) => console.error('[driver-hub] notify jornada:', e));
    }

    let mensaje: string;
    if (d.tipo === 'INICIO_SERVICIO') {
      mensaje = descansoInsuficiente
        ? `Inicio registrado. ATENCIÓN: solo descansaste ${horasDescanso}h (mínimo recomendado 12h). Avisá a tu supervisor.`
        : horasDescanso != null
          ? `Inicio de servicio registrado. Descansaste ${horasDescanso}h. Buen viaje.`
          : 'Inicio de servicio registrado. Buen viaje.';
    } else if (d.tipo === 'FIN_SERVICIO') {
      mensaje = horasTrabajadas != null
        ? `Fin de servicio registrado. Jornada: ${horasTrabajadas} horas.${jornadaExcesiva ? ' Supera las 12h — se notificó a la empresa.' : ''}`
        : 'Fin de servicio registrado. Gracias.';
    } else {
      mensaje = 'Nota de bitácora registrada.';
    }
    return reply.code(201).send({ ok: true, registroId: registro.id, mensaje, horasDescanso, horasTrabajadas, descansoInsuficiente, jornadaExcesiva });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — control de aptitud pre-servicio (fit-for-duty)
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/control', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;
    if (!vehiculo) return reply.code(400).send({ error: 'La unidad no está vinculada a un vehículo de flota' });

    const schema = z.object({
      presionSistolica: z.number().int().min(50).max(260).optional(),
      presionDiastolica: z.number().int().min(30).max(180).optional(),
      alcoholemia: z.number().min(0).max(5).optional(),
      temperatura: z.number().min(30).max(45).optional(),
      horasDescanso: z.number().min(0).max(24).optional(),
      nivelFatiga: z.number().int().min(1).max(9).optional(),
      tomaMedicamentos: z.boolean().default(false),
      medicamentosDetalle: z.string().max(500).optional(),
      observaciones: z.string().max(1000).optional(),
      conductorId: z.string().uuid().optional(),
      reportadoPorNombre: z.string().min(1).max(200),
      reportadoPorTelefono: z.string().max(50).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;

    // Evaluación de aptitud — umbrales de seguridad vial
    const motivos: string[] = [];
    if (d.alcoholemia != null && d.alcoholemia > 0) motivos.push(`Alcoholemia ${d.alcoholemia} g/L (debe ser 0)`);
    if (d.presionSistolica != null && (d.presionSistolica >= 160 || d.presionSistolica < 90)) motivos.push(`Presión sistólica ${d.presionSistolica} fuera de rango`);
    if (d.presionDiastolica != null && (d.presionDiastolica >= 100 || d.presionDiastolica < 50)) motivos.push(`Presión diastólica ${d.presionDiastolica} fuera de rango`);
    if (d.temperatura != null && d.temperatura >= 37.5) motivos.push(`Temperatura ${d.temperatura}°C (febril)`);
    if (d.horasDescanso != null && d.horasDescanso < 6) motivos.push(`Solo ${d.horasDescanso}h de descanso (mínimo 6h)`);
    if (d.nivelFatiga != null && d.nivelFatiga >= 7) motivos.push(`Nivel de fatiga ${d.nivelFatiga}/9 (somnolencia alta)`);
    if (d.tomaMedicamentos) motivos.push('Declara medicamentos que pueden afectar la conducción');
    const apto = motivos.length === 0;

    const control = await prisma().flotaControlPreServicio.create({
      data: {
        tenantId: qr.tenantId,
        vehiculoId: vehiculo.id,
        presionSistolica: d.presionSistolica ?? null,
        presionDiastolica: d.presionDiastolica ?? null,
        alcoholemia: d.alcoholemia ?? null,
        temperatura: d.temperatura ?? null,
        horasDescanso: d.horasDescanso ?? null,
        nivelFatiga: d.nivelFatiga ?? null,
        tomaMedicamentos: d.tomaMedicamentos,
        medicamentosDetalle: d.medicamentosDetalle || null,
        apto,
        motivos: motivos.length ? motivos.join('; ') : null,
        observaciones: d.observaciones || null,
        reportadoPorNombre: d.reportadoPorNombre,
        reportadoPorTelefono: d.reportadoPorTelefono || null,
      },
    });

    // Notificar a admins si el chofer NO está apto para conducir
    if (!apto) {
      notifyFlotaAlerta(prisma(), {
        tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
        titulo: 'Control pre-servicio NO APTO',
        detalle: `registró un control con resultado <strong>NO APTO</strong>: ${motivos.join('; ')}.`,
        reportadoPorNombre: d.reportadoPorNombre, link: '/flota-360/documentacion?tab=controles',
        entityType: 'flota_control_pre_servicio', entityId: control.id,
      }).catch((e: any) => console.error('[driver-hub] notify no apto:', e));
    }

    return reply.code(201).send({
      ok: true,
      controlId: control.id,
      apto,
      motivos,
      mensaje: apto
        ? 'Control registrado. Apto para tomar servicio.'
        : 'Control registrado. NO APTO para conducir — avisá a tu supervisor antes de salir.',
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — subir foto (ticket de combustible, evidencia de incidente/bitácora)
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr } = ctx;

    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });

      const MAX_SIZE = 10 * 1024 * 1024;
      if (data.file.bytesRead > MAX_SIZE) {
        return reply.code(400).send({ error: 'El archivo excede el tamaño máximo de 10MB' });
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowed.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Solo se permiten imágenes (JPG, PNG, WEBP) o PDF' });
      }

      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'driver-hub', qr.tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

      const ext = (data.filename.split('.').pop() || 'jpg').toLowerCase();
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), await data.toBuffer());

      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      const url = `${baseUrl}/uploads/driver-hub/${qr.tenantId}/${filename}`;
      return reply.send({ url, name: data.filename });
    } catch (e: any) {
      console.error('[driver-hub] upload error:', e);
      return reply.code(500).send({ error: 'No se pudo subir el archivo' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — documentos del chofer (CRUD)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/documentos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const documentos = await prisma().flotaDocumento.findMany({
      where: { tenantId },
      include: { vehiculo: { select: { id: true, dominio: true } } },
      orderBy: [{ categoria: 'asc' }, { createdAt: 'desc' }],
    });
    return reply.send({ documentos });
  });

  app.post('/documentos/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
      const MAX_SIZE = 20 * 1024 * 1024;
      if (data.file.bytesRead > MAX_SIZE) {
        return reply.code(400).send({ error: 'El archivo excede el tamaño máximo de 20MB' });
      }
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Solo se permiten PDF o imágenes' });
      }
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'driver-docs', tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const ext = (data.filename.split('.').pop() || 'pdf').toLowerCase();
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), await data.toBuffer());
      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      const url = `${baseUrl}/uploads/driver-docs/${tenantId}/${filename}`;
      return reply.send({ url, name: data.filename, mimeType: data.mimetype });
    } catch (e: any) {
      console.error('[driver-hub] doc upload error:', e);
      return reply.code(500).send({ error: 'No se pudo subir el archivo' });
    }
  });

  app.post('/documentos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      titulo: z.string().min(1).max(300),
      categoria: z.enum(['SEGURIDAD_HIGIENE', 'COMUNICADO', 'DOCUMENTO_UNIDAD', 'GENERAL']).default('GENERAL'),
      vehiculoId: z.string().uuid().optional().nullable(),
      fileUrl: z.string().min(1),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Validar que el vehículo pertenece al tenant
    if (body.data.vehiculoId) {
      const v = await prisma().vehiculo.findFirst({ where: { id: body.data.vehiculoId, tenantId } });
      if (!v) return reply.code(400).send({ error: 'Vehículo inválido' });
    }

    const user = (req as any).user;
    const documento = await prisma().flotaDocumento.create({
      data: {
        tenantId,
        titulo: body.data.titulo,
        categoria: body.data.categoria,
        vehiculoId: body.data.vehiculoId || null,
        fileUrl: body.data.fileUrl,
        fileName: body.data.fileName || null,
        mimeType: body.data.mimeType || null,
        uploadedById: user?.id || null,
        uploadedByNombre: user?.name || user?.email || null,
      },
    });
    return reply.code(201).send({ documento });
  });

  app.delete('/documentos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await prisma().flotaDocumento.deleteMany({ where: { id, tenantId } });
    return reply.send({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — incidentes reportados por choferes
  // ════════════════════════════════════════════════════════════════════════
  app.get('/incidentes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { estado, vehiculoId } = req.query as any;
    const incidentes = await prisma().flotaIncidente.findMany({
      where: {
        tenantId,
        ...(estado ? { estado } : {}),
        ...(vehiculoId ? { vehiculoId } : {}),
      },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send({ incidentes });
  });

  app.patch('/incidentes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({ estado: z.enum(['ABIERTO', 'EN_SEGUIMIENTO', 'CERRADO']) });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const updated = await prisma().flotaIncidente.updateMany({
      where: { id, tenantId },
      data: { estado: body.data.estado },
    });
    if (!updated.count) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — registros de servicio / bitácora
  // ════════════════════════════════════════════════════════════════════════
  app.get('/servicios', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId, tipo } = req.query as any;
    const registros = await prisma().servicioRegistro.findMany({
      where: {
        tenantId,
        ...(vehiculoId ? { vehiculoId } : {}),
        ...(tipo ? { tipo } : {}),
      },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return reply.send({ registros });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — controles de aptitud pre-servicio
  // ════════════════════════════════════════════════════════════════════════
  app.get('/controles', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { vehiculoId, apto, dias } = req.query as any;
    const desde = new Date(Date.now() - (Number(dias) || 30) * 86400000);
    const controles = await prisma().flotaControlPreServicio.findMany({
      where: {
        tenantId,
        createdAt: { gte: desde },
        ...(vehiculoId ? { vehiculoId } : {}),
        ...(apto === 'true' ? { apto: true } : apto === 'false' ? { apto: false } : {}),
      },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return reply.send({ controles });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — quién está en servicio ahora (último INICIO sin FIN posterior)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/en-servicio', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    // Último registro INICIO/FIN por unidad — si es INICIO, está en servicio
    const registros = await prisma().servicioRegistro.findMany({
      where: { tenantId, tipo: { in: ['INICIO_SERVICIO', 'FIN_SERVICIO'] } },
      include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const ultimoPorVehiculo = new Map<string, any>();
    for (const r of registros) {
      if (!ultimoPorVehiculo.has(r.vehiculoId)) ultimoPorVehiculo.set(r.vehiculoId, r);
    }
    const ahora = Date.now();
    const enServicio = [...ultimoPorVehiculo.values()]
      .filter((r: any) => r.tipo === 'INICIO_SERVICIO')
      .map((r: any) => ({
        id: r.id,
        vehiculo: r.vehiculo,
        chofer: r.reportadoPorNombre,
        conductorId: r.conductorId,
        desde: r.createdAt,
        horasEnServicio: Math.round(((ahora - new Date(r.createdAt).getTime()) / 3600000) * 10) / 10,
        origen: r.origen, destino: r.destino, carga: r.carga,
        horasDescanso: r.horasDescanso, descansoInsuficiente: r.descansoInsuficiente,
      }))
      .sort((a: any, b: any) => b.horasEnServicio - a.horasEnServicio);
    return reply.send({ enServicio });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — jornadas agregadas por chofer (horas trabajadas en el período)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/jornadas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { dias } = req.query as any;
    const desde = new Date(Date.now() - (Number(dias) || 30) * 86400000);

    const registros = await prisma().servicioRegistro.findMany({
      where: { tenantId, tipo: { in: ['INICIO_SERVICIO', 'FIN_SERVICIO'] }, createdAt: { gte: desde } },
      select: { tipo: true, conductorId: true, reportadoPorNombre: true, horasTrabajadas: true, horasDescanso: true, descansoInsuficiente: true, jornadaExcesiva: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const porChofer = new Map<string, any>();
    for (const r of registros) {
      const key = r.conductorId || (r.reportadoPorNombre || '').trim().toLowerCase();
      if (!key) continue;
      const acc = porChofer.get(key) || {
        chofer: r.reportadoPorNombre, conductorId: r.conductorId,
        servicios: 0, horasTotales: 0, jornadasExcesivas: 0, descansosInsuficientes: 0, ultimoRegistro: r.createdAt,
      };
      if (r.tipo === 'FIN_SERVICIO') {
        acc.servicios += 1;
        acc.horasTotales += r.horasTrabajadas || 0;
        if (r.jornadaExcesiva) acc.jornadasExcesivas += 1;
      } else if (r.tipo === 'INICIO_SERVICIO' && r.descansoInsuficiente) {
        acc.descansosInsuficientes += 1;
      }
      porChofer.set(key, acc);
    }
    const jornadas = [...porChofer.values()]
      .map((j: any) => ({ ...j, horasTotales: Math.round(j.horasTotales * 10) / 10, promedioJornada: j.servicios ? Math.round((j.horasTotales / j.servicios) * 10) / 10 : null }))
      .sort((a: any, b: any) => b.horasTotales - a.horasTotales);
    return reply.send({ jornadas, dias: Number(dias) || 30 });
  });
}
