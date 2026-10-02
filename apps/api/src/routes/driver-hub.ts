import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { notifyIncidenteReportado, notifyFlotaAlerta } from '../services/notifyService.js';
import { syncOdometroYDesgaste } from '../services/fleetTires.js';
import { restriccionesDelConjunto } from '../services/defectService.js';
import { impedimentosParaServicio } from '../services/unidadEstadoService.js';
import {
  verificarConductor, estadoServicioChofer, iniciarJornada, cerrarJornada,
  registrarCambioUnidad, registrarCambioServicio, corregirJornada, vincularControlConJornada,
  procesarAvisosJornada, getPoliticaJornada, POLITICA_DEFAULT, hashPin,
} from '../services/jornadaService.js';
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

    // Choferes activos para el selector (identidad fuerte en registros).
    // tienePin indica si el chofer tiene PIN configurado — el PIN en sí nunca
    // se expone, solo se valida en el servidor.
    const choferesDb = await prisma().conductor.findMany({
      where: { tenantId: qr.tenantId, status: 'ACTIVO' },
      select: { id: true, nombre: true, licenciaVto: true, psicofisicoVto: true, pinHash: true },
      orderBy: { nombre: 'asc' },
    }).catch(() => []);
    const choferes = choferesDb.map((c: any) => ({
      id: c.id, nombre: c.nombre, licenciaVto: c.licenciaVto, psicofisicoVto: c.psicofisicoVto,
      tienePin: !!c.pinHash,
    }));

    // Servicios comerciales activos: el chofer puede elegir a qué servicio
    // toma la unidad al iniciar la jornada (auto-asigna la unidad al servicio).
    const serviciosComerciales = await (prisma() as any).flotaServicio.findMany({
      where: { tenantId: qr.tenantId, activo: true },
      select: { id: true, nombre: true, cliente: true, origen: true, destino: true },
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
      serviciosComerciales,
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

    // Acuses de lectura: si el chofer se identificó (?conductorId=) marcamos
    // qué docs le faltan por leer → el frontend muestra banner "docs nuevos".
    const { conductorId, nombre } = req.query as any;
    let pendientes: string[] = [];
    if (documentos.length) {
      const lecturas = await prisma().flotaDocumentoLectura.findMany({
        where: {
          tenantId: qr.tenantId,
          documentoId: { in: documentos.map((d: any) => d.id) },
          ...(conductorId ? { conductorId } : {}),
        },
        select: { documentoId: true },
      }).catch(() => []);
      const leidos = new Set(lecturas.map((l: any) => l.documentoId));
      if (conductorId) {
        // Identificado: pendiente = este chofer no lo leyó
        pendientes = documentos.filter((d: any) => !leidos.has(d.id)).map((d: any) => d.id);
      } else if (nombre) {
        // Sin identificar pero con nombre libre: dedup por nombre (case-insensitive)
        const lecturasNombre = await prisma().flotaDocumentoLectura.findMany({
          where: { tenantId: qr.tenantId, documentoId: { in: documentos.map((d: any) => d.id) }, conductorNombre: { equals: String(nombre).trim(), mode: 'insensitive' } },
          select: { documentoId: true },
        }).catch(() => []);
        const leidosNombre = new Set(lecturasNombre.map((l: any) => l.documentoId));
        pendientes = documentos.filter((d: any) => !leidosNombre.has(d.id)).map((d: any) => d.id);
      } else {
        // Anónimo: pendiente = ningún chofer lo leyó todavía (doc "nuevo" para la flota)
        pendientes = documentos.filter((d: any) => !leidos.has(d.id)).map((d: any) => d.id);
      }
    }

    // Vencimientos de la unidad (VTV, seguro, habilitación…) — documentación propia
    const vencimientos = vehiculo
      ? await prisma().vencimientoDocumento.findMany({
          where: { vehiculoId: vehiculo.id, tenantId: qr.tenantId },
          orderBy: { fechaVto: 'asc' },
        })
      : [];

    return reply.send({ documentos, vencimientos, pendientes });
  });

  // ════════════════════════════════════════════════════════════════════════
  // PÚBLICO — acuse de lectura de un documento (evidencia para la empresa)
  // ════════════════════════════════════════════════════════════════════════
  app.post('/public/:token/documentos/:docId/visto', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, docId } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;

    const schema = z.object({
      conductorId: z.string().uuid().optional(),
      conductorNombre: z.string().min(1).max(200),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });

    const doc = await prisma().flotaDocumento.findFirst({ where: { id: docId, tenantId: qr.tenantId } });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });

    // Idempotente: un acuse por documento+chofer (o por nombre si no está identificado)
    const existente = body.data.conductorId
      ? await prisma().flotaDocumentoLectura.findFirst({ where: { documentoId: doc.id, conductorId: body.data.conductorId } })
      : await prisma().flotaDocumentoLectura.findFirst({ where: { documentoId: doc.id, conductorNombre: { equals: body.data.conductorNombre.trim(), mode: 'insensitive' } } });
    if (existente) return reply.send({ ok: true, alreadyRead: true, viewedAt: existente.viewedAt });

    const lectura = await prisma().flotaDocumentoLectura.create({
      data: {
        tenantId: qr.tenantId,
        documentoId: doc.id,
        vehiculoId: vehiculo?.id ?? null,
        conductorId: body.data.conductorId ?? null,
        conductorNombre: body.data.conductorNombre.trim(),
      },
    });
    return reply.code(201).send({ ok: true, viewedAt: lectura.viewedAt });
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
  // PÚBLICO — estado previo al inicio (informativo; la decisión real se toma
  // al confirmar, en el servidor, dentro de la transacción).
  app.post('/public/:token/servicio/estado', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr } = ctx;

    const schema = z.object({
      conductorId: z.string().uuid(),
      pin: z.string().min(1).max(20),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Conductor y PIN son obligatorios' });

    const ver = await verificarConductor(prisma(), qr.tenantId, body.data.conductorId, body.data.pin);
    if (!ver.ok) return reply.code(ver.code).send({ error: ver.error });

    const estado = await estadoServicioChofer(prisma(), qr.tenantId, ver.conductor.id);
    return reply.send(estado);
  });

  app.post('/public/:token/servicio', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const ctx = await resolveHubContext(prisma(), token);
    if (!ctx) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const { qr, vehiculo } = ctx;
    if (!vehiculo) return reply.code(400).send({ error: 'La unidad no está vinculada a un vehículo de flota' });

    const schema = z.object({
      tipo: z.enum(['INICIO_SERVICIO', 'FIN_SERVICIO', 'BITACORA', 'CAMBIO_UNIDAD', 'CAMBIO_SERVICIO']),
      odometro: z.number().positive().optional(),
      notas: z.string().max(2000).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      fotos: z.array(z.object({ url: z.string() })).optional(),
      origen: z.string().max(200).optional(),
      destino: z.string().max(200).optional(),
      carga: z.string().max(300).optional(),
      conductorId: z.string().uuid().optional(),
      pin: z.string().min(1).max(20).optional(),
      flotaServicioId: z.string().uuid().optional().nullable(),
      clienteEventoId: z.string().uuid().optional(),
      reportadoPorNombre: z.string().min(1).max(200).optional(),
      reportadoPorTelefono: z.string().max(50).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;
    const ahora = new Date();

    // ── Identidad verificada del conductor ──────────────────────────────────
    // INICIO/FIN/CAMBIO_UNIDAD exigen conductorId + PIN (el QR sólo identifica
    // la unidad). BITACORA admite nombre libre; si viene conductorId+PIN se
    // verifica y se vincula a la jornada abierta.
    let conductor: any = null;
    if (d.tipo !== 'BITACORA' || (d.conductorId && d.pin)) {
      const ver = await verificarConductor(prisma(), qr.tenantId, d.conductorId, d.pin);
      if (!ver.ok) return reply.code(ver.code).send({ error: ver.error });
      conductor = ver.conductor;
    }
    const nombre = conductor?.nombre || (d.reportadoPorNombre || '').trim();
    if (!nombre) return reply.code(400).send({ error: 'Identificá quién sos (nombre o conductor + PIN).' });

    // ── INICIO_SERVICIO — jornada explícita + política de descanso ──────────
    if (d.tipo === 'INICIO_SERVICIO') {
      // Impedimentos de servicio: situación administrativa, episodio de
      // indisponibilidad abierto (propio o del compañero acoplado) y
      // restricciones activas (propias o del conjunto). BLOQUEA el inicio.
      const impedimentos = await impedimentosParaServicio(prisma(), qr.tenantId, vehiculo);
      if (!impedimentos.ok) {
        const detalle = impedimentos.motivos.map((m: string) => `• ${m}`).join('\n');
        if (impedimentos.restricciones.length > 0) {
          notifyFlotaAlerta(prisma(), {
            tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
            titulo: 'Intento de toma de servicio con unidad restringida',
            detalle: `intentó iniciar servicio pero se rechazó: ${detalle}`,
            reportadoPorNombre: nombre, link: '/flota-360/inspecciones',
            entityType: 'restriccion_servicio', entityId: impedimentos.restricciones[0].id,
          }).catch((e: any) => console.error('[driver-hub] notify restriccion:', e));
        }
        const registro = await prisma().servicioRegistro.create({
          data: {
            tenantId: qr.tenantId, vehiculoId: vehiculo.id,
            tipo: 'INICIO_RECHAZADO',
            motivoRechazo: 'UNIDAD_NO_DISPONIBLE',
            clienteEventoId: d.clienteEventoId ? `${d.clienteEventoId}-r` : null,
            eventoAt: ahora, conductorId: conductor.id,
            reportadoPorNombre: nombre,
          },
        }).catch(() => null);
        return reply.code(409).send({
          error: 'Inicio no permitido',
          bloqueado: true,
          motivoRechazo: 'UNIDAD_NO_DISPONIBLE',
          registroId: registro?.id ?? null,
          impedimentos: impedimentos.motivos,
          mensaje: `No podés iniciar servicio: ${impedimentos.motivos.join('. ')}. Avisá a tu supervisor.`,
        });
      }

      const res = await iniciarJornada(prisma(), {
        tenantId: qr.tenantId, conductor, vehiculo, ahora,
        clienteEventoId: d.clienteEventoId, odometro: d.odometro, notas: d.notas,
        lat: d.lat, lng: d.lng, origen: d.origen, destino: d.destino, carga: d.carga,
        flotaServicioId: d.flotaServicioId,
        reportadoPorTelefono: d.reportadoPorTelefono,
      });

      if (res.result === 'RECHAZADO') {
        const msgs: Record<string, string> = {
          JORNADA_ABIERTA: 'Ya tenés una jornada abierta. No podés iniciar otra hasta resolverla — si cambiaste de unidad, usá "Cambio de unidad"; si quedó abierta por error, avisá a tu supervisor para regularizarla.',
          DESCANSO_INSUFICIENTE: `No podés iniciar: todavía no se cumplió el descanso mínimo de ${res.estado?.descansoMinHoras ?? 12}h desde tu último cierre.`,
          SIN_HISTORIAL: 'No podés iniciar: no hay historial suficiente para verificar tu descanso. Pedile al responsable una habilitación inicial.',
          CIERRE_NO_CONFIABLE: 'No podés iniciar: tu jornada anterior quedó sin cierre confiable. Pedile al responsable que la regularice o te habilite.',
        };
        return reply.code(409).send({
          error: 'Inicio no permitido',
          bloqueado: true,
          motivoRechazo: res.motivo,
          registroId: res.registro.id,
          estado: res.estado,
          mensaje: msgs[res.motivo] || 'Inicio no permitido.',
        });
      }

      // Sync odómetro + flag sospechoso
      const odometroSospechoso = !!(d.odometro && vehiculo.currentOdometer != null && (d.odometro - vehiculo.currentOdometer) > 2000);
      if (odometroSospechoso) {
        await prisma().servicioRegistro.update({ where: { id: res.registro.id }, data: { odometroSospechoso: true } }).catch(() => {});
      }
      if (d.odometro && (vehiculo.currentOdometer == null || d.odometro > vehiculo.currentOdometer)) {
        await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, d.odometro).catch(() => {});
        await prisma().maintenanceAsset.update({ where: { id: qr.maintenanceAssetId }, data: { currentOdometer: d.odometro } }).catch(() => {});
      }

      // Servicio comercial elegido por el chofer: auto-asigna la unidad
      // (si ya tiene asignación vigente en ese servicio no hace nada).
      if (d.flotaServicioId) {
        (async () => {
          const srv = await (prisma() as any).flotaServicio.findFirst({ where: { id: d.flotaServicioId, tenantId: qr.tenantId, activo: true }, select: { id: true } });
          if (!srv) return;
          const vigente = await (prisma() as any).flotaServicioUnidad.findFirst({
            where: { tenantId: qr.tenantId, servicioId: srv.id, vehiculoId: vehiculo.id, hasta: null },
            select: { id: true },
          });
          if (vigente) return;
          await (prisma() as any).flotaServicioUnidad.create({
            data: { tenantId: qr.tenantId, servicioId: srv.id, vehiculoId: vehiculo.id, desde: ahora },
          });
        })().catch((e: any) => console.error('[driver-hub] auto-assign servicio:', e));
      }

      const minDescanso = res.jornada?.politicaSnapshot?.descansoMinHoras ?? 12;
      if (res.evaluacion === 'INSUFICIENTE') {
        notifyFlotaAlerta(prisma(), {
          tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
          titulo: 'Descanso insuficiente al tomar servicio',
          detalle: `inició servicio con solo <strong>${res.descansoPrevioHoras}h</strong> entre jornadas (mínimo configurado ${minDescanso}h).`,
          reportadoPorNombre: nombre, link: '/flota-360/documentacion?tab=jornadas',
          entityType: 'flota_jornada', entityId: res.jornada?.id,
        }).catch((e: any) => console.error('[driver-hub] notify descanso:', e));
      }
      if (res.evaluacion === 'SIN_HISTORIAL' || res.evaluacion === 'CIERRE_NO_CONFIABLE') {
        notifyFlotaAlerta(prisma(), {
          tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
          titulo: 'Inicio sin descanso verificable',
          detalle: `inició servicio en modo advertencia sin evidencia suficiente de descanso (${res.evaluacion === 'SIN_HISTORIAL' ? 'sin historial en el sistema' : 'cierre previo no confiable'}).`,
          reportadoPorNombre: nombre, link: '/flota-360/documentacion?tab=jornadas',
          entityType: 'flota_jornada', entityId: res.jornada?.id,
        }).catch(() => {});
      }

      const mensaje = res.evaluacion === 'INSUFICIENTE'
        ? `Inicio registrado. ATENCIÓN: solo pasaron ${res.descansoPrevioHoras}h desde tu último cierre (mínimo configurado ${minDescanso}h). Avisá a tu supervisor.`
        : res.evaluacion === 'SIN_HISTORIAL'
          ? 'Inicio de servicio registrado. Sin historial suficiente para verificar descanso previo.'
          : res.evaluacion === 'CIERRE_NO_CONFIABLE'
            ? 'Inicio de servicio registrado. Tu jornada anterior quedó sin cierre confiable — quedó marcado para revisión.'
            : res.descansoPrevioHoras != null
              ? `Inicio de servicio registrado. Pasaron ${res.descansoPrevioHoras}h desde tu último cierre. Buen viaje.`
              : 'Inicio de servicio registrado. Buen viaje.';

      return reply.code(201).send({
        ok: true, registroId: res.registro.id, jornadaId: res.jornada?.id,
        mensaje, horasDescanso: res.descansoPrevioHoras,
        descansoInsuficiente: res.evaluacion === 'INSUFICIENTE',
        evaluacionDescanso: res.evaluacion,
        yaExistia: !!res.yaExistia,
      });
    }

    // ── FIN_SERVICIO — cierra SOLO la jornada abierta del propio conductor ──
    if (d.tipo === 'FIN_SERVICIO') {
      const res = await cerrarJornada(prisma(), {
        tenantId: qr.tenantId, conductor, vehiculo, ahora,
        clienteEventoId: d.clienteEventoId, odometro: d.odometro, notas: d.notas,
        lat: d.lat, lng: d.lng, reportadoPorTelefono: d.reportadoPorTelefono,
      });
      if (res.result === 'ERROR') {
        return reply.code(409).send({
          error: 'No tenés una jornada abierta',
          mensaje: 'No se encontró una jornada abierta a tu nombre. Si tu jornada quedó mal registrada, avisá a tu supervisor para regularizarla.',
        });
      }

      if (d.odometro && (vehiculo.currentOdometer == null || d.odometro > vehiculo.currentOdometer)) {
        await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, d.odometro).catch(() => {});
        await prisma().maintenanceAsset.update({ where: { id: qr.maintenanceAssetId }, data: { currentOdometer: d.odometro } }).catch(() => {});
      }
      const limite = res.jornada?.politicaSnapshot?.jornadaAlertaHoras ?? 12;
      if (res.jornadaExcesiva) {
        notifyFlotaAlerta(prisma(), {
          tenantId: qr.tenantId, vehiculoDominio: vehiculo.dominio,
          titulo: 'Jornada excesiva',
          detalle: `cerró servicio con una jornada de <strong>${res.horasTrabajadas}h</strong> (supera el límite configurado de ${limite}h).`,
          reportadoPorNombre: nombre, link: '/flota-360/documentacion?tab=jornadas',
          entityType: 'flota_jornada', entityId: res.jornada?.id,
        }).catch((e: any) => console.error('[driver-hub] notify jornada:', e));
      }
      return reply.code(201).send({
        ok: true, registroId: res.registro.id, jornadaId: res.jornada?.id,
        mensaje: `Fin de servicio registrado. Jornada: ${res.horasTrabajadas} horas.${res.jornadaExcesiva ? ` Supera el límite configurado (${limite}h) — se notificó a la empresa.` : ''}`,
        horasTrabajadas: res.horasTrabajadas, jornadaExcesiva: res.jornadaExcesiva,
      });
    }

    // ── CAMBIO_UNIDAD — se agrega la unidad a la jornada abierta, sin
    // reiniciarla ni contar descanso. La nueva unidad debe estar apta:
    // no se puede incorporar una unidad restringida/detenida a un servicio
    // ya iniciado.
    if (d.tipo === 'CAMBIO_UNIDAD') {
      const impedimentos = await impedimentosParaServicio(prisma(), qr.tenantId, vehiculo);
      if (!impedimentos.ok) {
        return reply.code(409).send({
          error: 'Unidad no disponible para servicio',
          bloqueado: true,
          impedimentos: impedimentos.motivos,
          mensaje: `No podés incorporar ${vehiculo.dominio}: ${impedimentos.motivos.join('. ')}.`,
        });
      }
      const res = await registrarCambioUnidad(prisma(), {
        tenantId: qr.tenantId, conductor, vehiculo, ahora,
        clienteEventoId: d.clienteEventoId, odometro: d.odometro, notas: d.notas,
      });
      if (!res.ok) {
        return reply.code(409).send({ error: 'Sin jornada abierta', mensaje: 'No tenés una jornada abierta para registrar el cambio de unidad. Iniciá servicio primero.' });
      }
      if (d.odometro && (vehiculo.currentOdometer == null || d.odometro > vehiculo.currentOdometer)) {
        await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, d.odometro).catch(() => {});
      }
      return reply.code(201).send({
        ok: true, registroId: res.registro.id, jornadaId: res.jornada?.id,
        mensaje: `Cambio de unidad registrado (${vehiculo.dominio}). Tu jornada sigue abierta.`,
      });
    }

    // ── CAMBIO_SERVICIO — la unidad pasa a cubrir otro servicio comercial
    // dentro de la misma jornada (sin cerrarla). null = queda sin servicio.
    if (d.tipo === 'CAMBIO_SERVICIO') {
      const res = await registrarCambioServicio(prisma(), {
        tenantId: qr.tenantId, conductor, vehiculo, ahora,
        flotaServicioId: d.flotaServicioId || null,
        clienteEventoId: d.clienteEventoId, odometro: d.odometro, notas: d.notas,
      });
      if (!res.ok) {
        return reply.code(409).send({ error: 'Sin jornada abierta', mensaje: 'No tenés una jornada abierta. Iniciá servicio primero.' });
      }
      // Auto-asigna la unidad al servicio elegido (contrato vigente)
      if (d.flotaServicioId) {
        (async () => {
          const srv = await (prisma() as any).flotaServicio.findFirst({ where: { id: d.flotaServicioId, tenantId: qr.tenantId, activo: true }, select: { id: true, nombre: true } });
          if (!srv) return;
          const vigente = await (prisma() as any).flotaServicioUnidad.findFirst({
            where: { tenantId: qr.tenantId, servicioId: srv.id, vehiculoId: vehiculo.id, hasta: null },
            select: { id: true },
          });
          if (vigente) return;
          await (prisma() as any).flotaServicioUnidad.create({
            data: { tenantId: qr.tenantId, servicioId: srv.id, vehiculoId: vehiculo.id, desde: ahora },
          });
        })().catch((e: any) => console.error('[driver-hub] auto-assign cambio servicio:', e));
      }
      if (d.odometro && (vehiculo.currentOdometer == null || d.odometro > vehiculo.currentOdometer)) {
        await syncOdometroYDesgaste(prisma(), qr.tenantId, vehiculo.id, d.odometro).catch(() => {});
      }
      return reply.code(201).send({
        ok: true, registroId: res.registro.id, jornadaId: res.jornada?.id,
        mensaje: d.flotaServicioId ? 'Servicio registrado — la unidad quedó asignada.' : 'Quedaste sin servicio asignado.',
      });
    }

    // ── BITACORA — nota libre; si el chofer está identificado se vincula a
    // su jornada abierta ──────────────────────────────────────────────────────
    let jornadaBitacora: any = null;
    if (conductor) {
      jornadaBitacora = await prisma().flotaJornada.findFirst({
        where: { tenantId: qr.tenantId, conductorId: conductor.id, estado: 'ABIERTA' },
        select: { id: true },
      });
    }
    const registro = await prisma().servicioRegistro.create({
      data: {
        tenantId: qr.tenantId,
        vehiculoId: vehiculo.id,
        jornadaId: jornadaBitacora?.id ?? null,
        tipo: 'BITACORA',
        odometro: d.odometro ?? null,
        notas: d.notas || null,
        lat: d.lat ?? null, lng: d.lng ?? null,
        fotos: d.fotos ?? null,
        clienteEventoId: d.clienteEventoId ?? null,
        eventoAt: ahora,
        conductorId: conductor?.id ?? null,
        reportadoPorNombre: nombre,
        reportadoPorTelefono: d.reportadoPorTelefono || null,
      },
    });
    return reply.code(201).send({ ok: true, registroId: registro.id, mensaje: 'Nota de bitácora registrada.' });
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
        conductorId: d.conductorId || null,
      },
    });

    // Contrastar el descanso DECLARADO con la jornada abierta del conductor
    // (no sustituye el cálculo: solo marca discrepancia declarado vs calculado)
    if (d.conductorId && d.horasDescanso != null) {
      await vincularControlConJornada(prisma(), qr.tenantId, d.conductorId, d.horasDescanso).catch(() => {});
    }

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
      include: {
        vehiculo: { select: { id: true, dominio: true } },
        lecturas: { orderBy: { viewedAt: 'desc' }, take: 50 },
      },
      orderBy: [{ categoria: 'asc' }, { createdAt: 'desc' }],
    });
    return reply.send({ documentos });
  });

  // EMPRESA — acuses de lectura de un documento (quién lo vio y cuándo)
  app.get('/documentos/:id/lecturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const doc = await prisma().flotaDocumento.findFirst({ where: { id, tenantId }, select: { id: true, titulo: true } });
    if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });
    const lecturas = await prisma().flotaDocumentoLectura.findMany({
      where: { documentoId: id, tenantId },
      orderBy: { viewedAt: 'desc' },
      take: 200,
    });
    return reply.send({ documento: doc, lecturas });
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
    const { vehiculoId, tipo, conductorId, page, pageSize } = req.query as any;
    const take = Math.min(Number(pageSize) || 300, 500);
    const skip = Math.max(0, (Number(page) || 1) - 1) * take;
    const where: any = {
      tenantId,
      ...(vehiculoId ? { vehiculoId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(conductorId ? { conductorId } : {}),
    };
    const [registros, total] = await Promise.all([
      prisma().servicioRegistro.findMany({
        where,
        include: { vehiculo: { select: { id: true, dominio: true, tipo: true } } },
        orderBy: { createdAt: 'desc' },
        take, skip,
      }),
      prisma().servicioRegistro.count({ where }),
    ]);
    return reply.send({ registros, total, page: Number(page) || 1, pageSize: take });
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

    // Fuente única: jornadas ABIERTAS (la unidad actual es la última del array)
    const [abiertas, vehiculos] = await Promise.all([
      prisma().flotaJornada.findMany({
        where: { tenantId, estado: 'ABIERTA' },
        include: { conductor: { select: { id: true, nombre: true } } },
        orderBy: { inicioAt: 'desc' },
      }),
      prisma().vehiculo.findMany({ where: { tenantId }, select: { id: true, dominio: true, tipo: true } }),
    ]);
    const vehMap = new Map(vehiculos.map((v: any) => [v.id, v]));
    const ahora = Date.now();
    const enServicio = abiertas.map((j: any) => {
      const unidades: any[] = Array.isArray(j.unidades) ? j.unidades : [];
      const ultimaUnidad = unidades.length ? unidades[unidades.length - 1] : null;
      return {
        id: j.id,
        vehiculo: ultimaUnidad ? vehMap.get(ultimaUnidad.vehiculoId) || { id: ultimaUnidad.vehiculoId, dominio: ultimaUnidad.dominio } : null,
        chofer: j.conductor?.nombre || '—',
        conductorId: j.conductorId,
        desde: j.inicioAt,
        horasEnServicio: Math.round(((ahora - new Date(j.inicioAt).getTime()) / 3600000) * 10) / 10,
        origen: j.origen, destino: j.destino, carga: j.carga,
        horasDescanso: j.descansoPrevioHoras,
        descansoInsuficiente: j.evaluacionDescanso === 'INSUFICIENTE',
        evaluacionDescanso: j.evaluacionDescanso,
        unidades,
      };
    }).sort((a: any, b: any) => b.horasEnServicio - a.horasEnServicio);
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

    const jornadasDb = await prisma().flotaJornada.findMany({
      where: { tenantId, inicioAt: { gte: desde } },
      include: { conductor: { select: { id: true, nombre: true } } },
      orderBy: { inicioAt: 'desc' },
    });

    const porChofer = new Map<string, any>();
    for (const j of jornadasDb) {
      const key = j.conductorId;
      const acc = porChofer.get(key) || {
        chofer: j.conductor?.nombre || '—', conductorId: j.conductorId,
        servicios: 0, horasTotales: 0, jornadasExcesivas: 0, descansosInsuficientes: 0,
        sinHistorial: 0, regularizadas: 0, abiertas: 0, ultimoRegistro: j.inicioAt,
      };
      if (j.estado === 'ABIERTA') {
        acc.abiertas += 1;
      } else {
        acc.servicios += 1;
        acc.horasTotales += j.horasTrabajadas || 0;
        if (j.jornadaExcesiva) acc.jornadasExcesivas += 1;
        if (j.evaluacionDescanso === 'INSUFICIENTE') acc.descansosInsuficientes += 1;
        if (j.evaluacionDescanso === 'SIN_HISTORIAL' || j.evaluacionDescanso === 'CIERRE_NO_CONFIABLE') acc.sinHistorial += 1;
        if (j.cierreTipo === 'REGULARIZADO') acc.regularizadas += 1;
      }
      porChofer.set(key, acc);
    }
    const jornadas = [...porChofer.values()]
      .map((j: any) => ({ ...j, horasTotales: Math.round(j.horasTotales * 10) / 10, promedioJornada: j.servicios ? Math.round((j.horasTotales / j.servicios) * 10) / 10 : null }))
      .sort((a: any, b: any) => b.horasTotales - a.horasTotales);
    return reply.send({ jornadas, dias: Number(dias) || 30 });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — JORNADAS EXPLÍCITAS (entidad FlotaJornada)
  // ════════════════════════════════════════════════════════════════════════

  // Helper local: exige rol de administración (tenant admin o superadmin)
  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    if (auth?.globalRole === 'SUPERADMIN') return null;
    if (auth?.tenantRole === 'TENANT_ADMIN') return null;
    return reply.code(403).send({ error: 'Se requiere rol de administrador para esta acción.' });
  };

  // Lista de jornadas con filtros — fuente única para paneles y reportes
  app.get('/jornadas-lista', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { conductorId, estado, desde, hasta, page, pageSize } = req.query as any;
    const take = Math.min(Number(pageSize) || 50, 200);
    const skip = Math.max(0, (Number(page) || 1) - 1) * take;

    const where: any = {
      tenantId,
      ...(conductorId ? { conductorId } : {}),
      ...(estado ? { estado } : {}),
      ...((desde || hasta) ? { inicioAt: {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(new Date(hasta).setHours(23, 59, 59, 999)) } : {}),
      } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma().flotaJornada.findMany({
        where,
        include: {
          conductor: { select: { id: true, nombre: true } },
          _count: { select: { correcciones: true } },
        },
        orderBy: { inicioAt: 'desc' },
        take, skip,
      }),
      prisma().flotaJornada.count({ where }),
    ]);
    return reply.send({ items, total, page: Number(page) || 1, pageSize: take });
  });

  // Detalle de una jornada: registros, correcciones, avisos
  app.get('/jornadas-lista/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const jornada = await prisma().flotaJornada.findFirst({
      where: { id, tenantId },
      include: {
        conductor: { select: { id: true, nombre: true } },
        registros: { orderBy: { eventoAt: 'asc' }, select: { id: true, tipo: true, vehiculoId: true, eventoAt: true, notas: true, odometro: true } },
        correcciones: { orderBy: { corregidoEn: 'desc' } },
        avisos: true,
      },
    });
    if (!jornada) return reply.code(404).send({ error: 'Jornada no encontrada' });
    return reply.send({ jornada });
  });

  // Corrección autorizada de horarios — admin only, motivo obligatorio
  app.post('/jornadas-lista/:id/corregir', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const { id } = req.params as any;
    const auth = (req as any).auth;

    const schema = z.object({
      inicioAt: z.string().datetime({ offset: true }).optional(),
      finAt: z.string().datetime({ offset: true }).nullable().optional(),
      motivo: z.string().min(5).max(500),
      evidencia: z.string().max(2000).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos (motivo de al menos 5 caracteres requerido)', details: body.error.errors });

    const res = await corregirJornada(prisma(), {
      tenantId, jornadaId: id, userId: auth?.userId,
      inicioAt: body.data.inicioAt ? new Date(body.data.inicioAt) : undefined,
      finAt: body.data.finAt !== undefined ? (body.data.finAt ? new Date(body.data.finAt) : null) : undefined,
      motivo: body.data.motivo, evidencia: body.data.evidencia,
    });
    if (!res.ok) return reply.code(res.code).send({ error: res.error });
    return reply.send({ ok: true, jornada: res.jornada });
  });

  // Regularización: cerrar una jornada quedada ABIERTA sin horario real
  // (el fin no fue informado). Queda CERRADA sin finAt → CIERRE_NO_CONFIABLE
  // para el próximo inicio, trazable con motivo.
  app.post('/jornadas-lista/:id/regularizar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const { id } = req.params as any;
    const auth = (req as any).auth;

    const schema = z.object({ motivo: z.string().min(5).max(500), evidencia: z.string().max(2000).optional() });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Motivo obligatorio (mín. 5 caracteres)' });

    const jornada = await prisma().flotaJornada.findFirst({ where: { id, tenantId } });
    if (!jornada) return reply.code(404).send({ error: 'Jornada no encontrada' });
    if (jornada.estado !== 'ABIERTA') return reply.code(409).send({ error: 'La jornada ya está cerrada.' });

    const actualizada = await prisma().$transaction(async (tx: any) => {
      await tx.flotaJornadaCorreccion.create({
        data: { tenantId, jornadaId: id, campo: 'cierre_regularizacion', valorAnterior: 'ABIERTA', valorNuevo: 'CERRADA_SIN_FIN', motivo: body.data.motivo, evidencia: body.data.evidencia || null, corregidoPorId: auth?.userId },
      });
      return tx.flotaJornada.update({
        where: { id },
        data: { estado: 'CERRADA', finAt: null, cierreTipo: 'REGULARIZADO', cierreMotivo: body.data.motivo, cerradaPorUserId: auth?.userId },
      });
    });
    return reply.send({ ok: true, jornada: actualizada });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — HABILITACIÓN DE INICIO SIN HISTORIAL (circuito autorizado)
  // ════════════════════════════════════════════════════════════════════════

  app.post('/habilitaciones-descanso', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const auth = (req as any).auth;

    const schema = z.object({
      conductorId: z.string().uuid(),
      tipo: z.enum(['SIN_HISTORIAL', 'CIERRE_NO_CONFIABLE']).default('SIN_HISTORIAL'),
      descansoDeclaradoHoras: z.number().min(0).max(96).optional(),
      fundamento: z.string().min(5).max(1000),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos (fundamento obligatorio)' });
    const d = body.data;

    const conductor = await prisma().conductor.findFirst({ where: { id: d.conductorId, tenantId } });
    if (!conductor) return reply.code(404).send({ error: 'Conductor no encontrado' });

    const yaExiste = await prisma().flotaHabilitacionDescanso.findFirst({
      where: { tenantId, conductorId: d.conductorId, usadaEnJornadaId: null },
    });
    if (yaExiste) return reply.code(409).send({ error: 'Ya existe una habilitación vigente para este conductor.' });

    const hab = await prisma().flotaHabilitacionDescanso.create({
      data: {
        tenantId, conductorId: d.conductorId, tipo: d.tipo,
        descansoDeclaradoHoras: d.descansoDeclaradoHoras ?? null,
        fundamento: d.fundamento, autorizadoPorId: auth?.userId,
      },
    });
    return reply.code(201).send({ habilitacion: hab });
  });

  app.get('/habilitaciones-descanso', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const habilitaciones = await prisma().flotaHabilitacionDescanso.findMany({
      where: { tenantId },
      include: { conductor: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send({ habilitaciones });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — POLÍTICA DE JORNADA/DESCANSO (configurable, versionada)
  // ════════════════════════════════════════════════════════════════════════

  app.get('/jornada-politica', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const politica = await getPoliticaJornada(prisma(), tenantId);
    const historial = await prisma().flotaJornadaPoliticaHistorial.findMany({
      where: { tenantId }, orderBy: { version: 'desc' }, take: 10,
    });
    return reply.send({ politica, defaults: POLITICA_DEFAULT, historial });
  });

  app.patch('/jornada-politica', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const auth = (req as any).auth;

    const schema = z.object({
      descansoMinHoras: z.number().min(4).max(24).optional(),
      modoAplicacion: z.enum(['ADVERTENCIA', 'BLOQUEO']).optional(),
      jornadaAlertaHoras: z.number().min(4).max(24).optional(),
      avisoAnticipacionHoras: z.number().min(0.5).max(8).optional(),
      destinatarios: z.union([z.literal('ADMINS'), z.array(z.string().uuid()).min(1)]).optional(),
      politicaRevisada: z.boolean().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;

    // Regla: para activar BLOQUEO el responsable debe confirmar la revisión
    const modoDestino = d.modoAplicacion;
    if (modoDestino === 'BLOQUEO' && d.politicaRevisada !== true) {
      return reply.code(400).send({ error: 'Para activar el modo BLOQUEO confirmá la revisión de la política (politicaRevisada=true).' });
    }

    const actualizada = await prisma().$transaction(async (tx: any) => {
      const previa = await tx.flotaJornadaPolitica.findUnique({ where: { tenantId } });
      if (previa) {
        await tx.flotaJornadaPoliticaHistorial.create({
          data: { tenantId, politicaId: previa.id, version: previa.version, valores: previa, changedById: auth?.userId },
        });
      }
      return tx.flotaJornadaPolitica.upsert({
        where: { tenantId },
        create: { tenantId, ...d, politicaRevisada: d.politicaRevisada ?? (d.modoAplicacion ? true : false), updatedById: auth?.userId },
        update: { ...d, version: { increment: 1 }, updatedById: auth?.userId },
      });
    });
    return reply.send({ ok: true, politica: actualizada });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — PIN DE CONDUCTOR (identidad del hub QR)
  // ════════════════════════════════════════════════════════════════════════

  app.post('/conductores/:id/pin', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const { id } = req.params as any;
    const auth = (req as any).auth;

    const schema = z.object({ pin: z.string().regex(/^\d{4,8}$/, 'PIN de 4 a 8 dígitos') });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'PIN inválido: debe tener 4 a 8 dígitos.' });

    const conductor = await prisma().conductor.findFirst({ where: { id, tenantId } });
    if (!conductor) return reply.code(404).send({ error: 'Conductor no encontrado' });

    const pinHash = await hashPin(body.data.pin);
    await prisma().conductor.update({
      where: { id },
      data: { pinHash, pinSetAt: new Date(), pinSetById: auth?.userId },
    });
    return reply.send({ ok: true });
  });

  app.delete('/conductores/:id/pin', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const denied = await requireAdmin(req, reply); if (denied) return denied;
    const { id } = req.params as any;
    await prisma().conductor.updateMany({ where: { id, tenantId }, data: { pinHash: null, pinSetAt: null, pinSetById: null } });
    return reply.send({ ok: true });
  });

  // ════════════════════════════════════════════════════════════════════════
  // EMPRESA — CONCILIACIÓN: inconsistencias heredadas para revisar
  // ════════════════════════════════════════════════════════════════════════
  app.get('/jornadas-conciliacion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const [sinInicio, sinFin, intentosRechazados, jornadasViejas] = await Promise.all([
      // FIN sin jornada vinculada (huérfanos)
      prisma().servicioRegistro.count({ where: { tenantId, tipo: 'FIN_SERVICIO', jornadaId: null } }),
      // INICIO sin jornada vinculada (legacy o ambiguo en backfill)
      prisma().servicioRegistro.count({ where: { tenantId, tipo: 'INICIO_SERVICIO', jornadaId: null } }),
      // Intentos de inicio rechazados
      prisma().servicioRegistro.findMany({
        where: { tenantId, tipo: 'INICIO_RECHAZADO' },
        orderBy: { eventoAt: 'desc' }, take: 50,
        select: { id: true, reportadoPorNombre: true, motivoRechazo: true, eventoAt: true, vehiculoId: true },
      }),
      // Jornadas abiertas hace más de 36h (posible cierre omitido)
      prisma().flotaJornada.findMany({
        where: { tenantId, estado: 'ABIERTA', inicioAt: { lt: new Date(Date.now() - 36 * 3600000) } },
        include: { conductor: { select: { id: true, nombre: true } } },
      }),
    ]);
    return reply.send({
      sinInicio, sinFin, intentosRechazados,
      jornadasAbiertasViejas: jornadasViejas,
      hayInconsistencias: sinInicio + sinFin + jornadasViejas.length > 0,
    });
  });

  // Procesar avisos pendientes (llamado también desde el scheduler)
  app.post('/jornadas-procesar-avisos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    await procesarAvisosJornada(prisma(), tenantId);
    return reply.send({ ok: true });
  });
}
