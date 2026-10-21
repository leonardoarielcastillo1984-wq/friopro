import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';
import { randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================
// Copiloto transversal SGI360
// Patrón: código calcula (queries determinísticas sobre prisma),
// IA explica/propone, humano confirma. Las acciones propuestas
// llegan al cliente como bloques ```action {...}``` y SOLO se
// ejecutan en POST /confirm tras clic del usuario.
// Gobernanza: usuarios sin rol admin/owner ven datos de solo
// lectura de módulos operativos; acciones requieren permisos.
// ============================================================

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1).max(30),
});

const num = (v: any): number => (v == null ? 0 : typeof v === 'number' ? v : parseFloat(String(v)) || 0);
const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');

async function resolveUserRole(prisma: any, userId: string | null | undefined): Promise<{ role: string; canAct: boolean }> {
  if (!userId) return { role: 'USER', canAct: false };
  try {
    const u = await prisma.platformUser.findUnique({ where: { id: userId }, select: { role: true, isAdmin: true, permissions: true } });
    const role = (u?.role || (u?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    const perms: any[] = Array.isArray(u?.permissions) ? u.permissions : [];
    const canAct = role === 'ADMIN' || role === 'OWNER' || role === 'SUPER_ADMIN' || perms.includes('*') || perms.includes('flota-360');
    return { role, canAct };
  } catch {
    return { role: 'USER', canAct: false };
  }
}

// ── Contexto determinístico del negocio ──
async function buildContext(prisma: any, tenantId: string, msg: string): Promise<string> {
  const q = msg.toLowerCase();
  const parts: string[] = [];
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const since90 = new Date(Date.now() - 90 * 86400_000);

  // KPIs siempre presentes (baratos)
  try {
    const [veh, ots, servicios, factPend] = await Promise.all([
      prisma.vehiculo.count({ where: { tenantId, status: { not: 'BAJA' } } }),
      prisma.workOrder.count({ where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.flotaServicio.count({ where: { tenantId, activo: true } }),
      prisma.finanzaFactura.count({ where: { tenantId, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] } } }),
    ]);
    parts.push(`RESUMEN: ${veh} vehículos activos, ${ots} OTs abiertas, ${servicios} servicios vigentes, ${factPend} facturas por cobrar.`);
  } catch {}

  const wantsFleet = /camion|camión|vehicul|vehícul|flota|patente|ot\b|orden|neum|cubierta|service|taller|manteni|unidad/i.test(q);
  const wantsFin = /factur|cobr|pag|cliente|resultado|margen|costo|gasto|ingres|finanz|rentab/i.test(q);
  const wantsServ = /servicio|viaje|cliente|contrato/i.test(q);
  const wantsCaja = /caja|flujo|proyec|previs|semana|queda|falta/i.test(q);
  const wantsAnom = /anomal|raro|subi|subió|atípic|anormal|incremento|doble/i.test(q);

  if (wantsFleet || wantsAnom) {
    try {
      const vehiculos = await prisma.vehiculo.findMany({
        where: { tenantId, status: { not: 'BAJA' } },
        select: { id: true, dominio: true, tipo: true, status: true },
        take: 40,
      });
      const ots = await prisma.workOrder.findMany({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        select: { code: true, title: true, priority: true, type: true, activoNombreLibre: true },
        take: 20,
        orderBy: { id: 'desc' },
      });
      parts.push(`FLOTA: ${JSON.stringify(vehiculos)}\nOTs_ABIERTAS: ${JSON.stringify(ots)}`);

      const gastosMes = await prisma.flotaFactura.groupBy({
        by: ['categoria'],
        where: { tenantId, fecha: { gte: since30 }, moneda: 'ARS' },
        _sum: { total: true },
      });
      const gastosPrev = await prisma.flotaFactura.groupBy({
        by: ['categoria'],
        where: { tenantId, fecha: { gte: since90, lt: since30 }, moneda: 'ARS' },
        _sum: { total: true },
      });
      parts.push(`GASTOS_FLOTA_30D: ${JSON.stringify(gastosMes.map((g: any) => ({ cat: g.categoria, total: num(g._sum.total) })))}`);
      parts.push(`GASTOS_FLOTA_90D_PREV (÷3=mes): ${JSON.stringify(gastosPrev.map((g: any) => ({ cat: g.categoria, total: num(g._sum.total) })))}`);

      // anomalías determinísticas
      const anom: string[] = [];
      for (const g of gastosMes) {
        const prev = gastosPrev.find((p: any) => p.categoria === g.categoria);
        const prom = prev ? num(prev._sum.total) / 2 : 0;
        const actual = num(g._sum.total);
        if (prom > 0 && actual > prom * 1.5) anom.push(`${g.categoria}: $${fmt(actual)} este mes vs promedio $${fmt(prom)} (+${Math.round(((actual - prom) / prom) * 100)}%)`);
      }
      if (anom.length) parts.push(`ANOMALIAS_COSTO: ${anom.join(' | ')}`);
    } catch {}
  }

  if (wantsFin || wantsCaja) {
    try {
      const porEstado = await prisma.finanzaFactura.groupBy({
        by: ['estado'],
        where: { tenantId, deletedAt: null },
        _sum: { total: true }, _count: true,
      });
      parts.push(`FACTURAS_EMITIDAS_POR_ESTADO: ${JSON.stringify(porEstado.map((f: any) => ({ estado: f.estado, n: f._count, total: num(f._sum.total) })))}`);
      const vencidas = await prisma.finanzaFactura.findMany({
        where: { tenantId, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA', 'VENCIDA'] }, fechaVencimiento: { lt: new Date() } },
        select: { clienteNombre: true, total: true, fechaVencimiento: true, numero: true },
        orderBy: { fechaVencimiento: 'asc' }, take: 10,
      });
      if (vencidas.length) parts.push(`CXC_VENCIDAS: ${JSON.stringify(vencidas.map((f: any) => ({ cliente: f.clienteNombre, n: f.numero, total: num(f.total), vto: f.fechaVencimiento })))}`);
      const emitidasMes = await prisma.finanzaFactura.aggregate({
        where: { tenantId, deletedAt: null, fechaEmision: { gte: since30 } },
        _sum: { total: true },
      });
      const pagosPend = await prisma.flotaFactura.findMany({
        where: { tenantId, pagadaAt: null, fechaVencimiento: { not: null } },
        select: { proveedor: true, total: true, fechaVencimiento: true, categoria: true },
        orderBy: { fechaVencimiento: 'asc' }, take: 15,
      });
      parts.push(`EMITIDO_30D: $${fmt(num(emitidasMes._sum.total))}`);
      parts.push(`CXP_PENDIENTES: ${JSON.stringify(pagosPend.map((f: any) => ({ prov: f.proveedor, cat: f.categoria, total: num(f.total), vto: f.fechaVencimiento })))}`);
    } catch {}
  }

  if (wantsServ || wantsCaja) {
    try {
      const servicios = await prisma.flotaServicio.findMany({
        where: { tenantId, activo: true },
        select: { nombre: true, cliente: true, tipo: true, modalidadCobro: true, monto: true, origen: true, destino: true },
        take: 30,
      });
      parts.push(`SERVICIOS_VIGENTES: ${JSON.stringify(servicios)}`);
      const ingresosMens = servicios.filter((s: any) => s.modalidadCobro === 'POR_MES').reduce((a: number, s: any) => a + num(s.monto), 0)
        + servicios.filter((s: any) => s.modalidadCobro === 'POR_DIA').reduce((a: number, s: any) => a + num(s.monto) * 20, 0);
      if (ingresosMens > 0) parts.push(`INGRESO_ESTIMADO_MES (fijos+mensuales): ~$${fmt(ingresosMens)}`);
    } catch {}
  }

  // unidad puntual por patente
  const patente = msg.toUpperCase().match(/\b[A-Z]{2,3}\s?\d{3}\s?[A-Z]{0,3}\b|\b[A-Z]{2}\d{3}[A-Z]{2}\b/)?.[0]?.replace(/\s/g, '');
  if (patente) {
    try {
      const v = await prisma.vehiculo.findFirst({ where: { tenantId, dominio: { contains: patente, mode: 'insensitive' } } });
      if (v) {
        const [gastos, otsV] = await Promise.all([
          prisma.flotaFactura.groupBy({ by: ['categoria'], where: { tenantId, vehiculoId: v.id }, _sum: { total: true } }),
          prisma.workOrder.findMany({ where: { tenantId, OR: [{ activoNombreLibre: { contains: v.dominio, mode: 'insensitive' } }] }, select: { code: true, title: true, status: true, type: true }, take: 10 }),
        ]);
        parts.push(`UNIDAD ${v.dominio} (tipo ${v.tipo}, estado ${v.status}). GASTOS_POR_CAT: ${JSON.stringify(gastos.map((g: any) => ({ cat: g.categoria, total: num(g._sum.total) })))}. OTs: ${JSON.stringify(otsV)}`);
      }
    } catch {}
  }

  return parts.join('\n');
}

const SYSTEM = `Sos el copiloto de gestión de SGI360, un sistema operativo empresarial de logística/transporte.
Respondé SIEMPRE en español argentino, concreto y accionable. Reglas duras:
- NUNCA inventes números. Solo usá los datos del CONTEXTO que te paso. Si el dato no está, decilo y ofrecé cómo obtenerlo.
- Cifras en pesos con formato $123.456. Fechas cortas.
- Para preguntas de gestión: primero el diagnóstico, después 1-2 acciones concretas.
- Si el usuario pide HACER algo (crear OT, plan de acción, registrar gasto), NO lo ejecutes vos: proponé la acción emitiendo un bloque
\`\`\`action
{"type":"CREATE_OT"|"CREATE_ACTION_PLAN","title":"...","payload":{...}}
\`\`\`
El usuario lo confirmará con un botón. Para CREATE_OT: payload = {title, vehiculo?, type?: PREVENTIVE|CORRECTIVE|EMERGENCY, priority?: LOW|MEDIUM|HIGH|CRITICAL, description?}. Para CREATE_ACTION_PLAN: payload = {findingDescription, immediateCorrection?, area?, process?}.`;

export async function copilotRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma;

  // ── CHAT ──
  app.post('/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = chatSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });

    const userId = (req as any).auth?.userId ?? null;
    const { canAct } = await resolveUserRole(prisma(), userId);
    const lastMsg = body.data.messages[body.data.messages.length - 1].content;

    const context = await buildContext(prisma(), tenantId, lastMsg);
    const llm = createGroqOnlyLLMProvider(null, prisma(), tenantId, userId, 'copilot');

    const systemMsg = `${SYSTEM}\n\nGobernanza: el usuario${canAct ? ' SÍ puede' : ' NO puede'} ejecutar acciones; ${canAct ? 'podés proponer acciones' : 'respondé solo con información, sin bloques de acción'}.\n\nCONTEXTO DEL NEGOCIO (datos reales, calculados por el sistema — no inventados):\n${context || '(sin datos relevantes para esta consulta)'}`;

    try {
      const resp = await llm.chat([
        { role: 'user', content: systemMsg },
        ...body.data.messages.slice(-12),
      ], 1400);

      // extraer acciones propuestas
      const actions: any[] = [];
      const replyText = resp.text.replace(/```action\s*([\s\S]*?)```/g, (_m, json) => {
        try {
          const a = JSON.parse(json);
          if (canAct && (a.type === 'CREATE_OT' || a.type === 'CREATE_ACTION_PLAN')) actions.push(a);
        } catch {}
        return '';
      }).trim();

      return reply.send({ reply: replyText, actions, model: resp.model });
    } catch (e: any) {
      if (e.code === 'LLM_NOT_CONFIGURED' || String(e.message || '').includes('GROQ_API_KEY')) {
        return reply.code(503).send({ error: 'El copiloto no está configurado en este entorno (falta GROQ_API_KEY).' });
      }
      app.log.error(e, 'copilot chat error');
      return reply.code(500).send({ error: 'Error procesando la consulta' });
    }
  });

  // ── CONFIRMAR ACCIÓN (solo esto escribe) ──
  app.post('/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = (req as any).auth?.userId ?? null;
    const { canAct } = await resolveUserRole(prisma(), userId);
    if (!canAct) return reply.code(403).send({ error: 'Tu rol no permite ejecutar acciones del copiloto' });

    const { action } = req.body as any;
    if (!action?.type) return reply.code(400).send({ error: 'Acción inválida' });

    try {
      if (action.type === 'CREATE_OT') {
        const p = action.payload || {};
        const code = `OT-IA-${Date.now().toString(36).toUpperCase()}`;
        const ot = await app.runWithDbContext(req, async (tx: any) =>
          tx.workOrder.create({
            data: {
              tenantId,
              code,
              title: String(p.title || 'OT generada por copiloto').slice(0, 200),
              description: String(p.description || `Creada por copiloto IA${p.vehiculo ? ` para ${p.vehiculo}` : ''}`).slice(0, 2000),
              type: ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'].includes(p.type) ? p.type : 'CORRECTIVE',
              priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(p.priority) ? p.priority : 'MEDIUM',
              status: 'PENDING',
              origen: 'COPILOTO',
              activoNombreLibre: p.vehiculo ? String(p.vehiculo).slice(0, 60) : null,
            },
          }));
        return reply.code(201).send({ ok: true, kind: 'OT', id: ot.id, code: ot.code, message: `OT ${ot.code} creada en estado PENDIENTE` });
      }

      if (action.type === 'CREATE_ACTION_PLAN') {
        const p = action.payload || {};
        const plan = await app.runWithDbContext(req, async (tx: any) => {
          const seq = await tx.$queryRaw`SELECT COALESCE(MAX("sequenceNumber"),0)+1 AS seq FROM "action_plans" WHERE "tenantId"=${tenantId}`;
          return tx.actionPlan.create({
            data: {
              tenantId,
              sequenceNumber: (seq as any)?.[0]?.seq ?? undefined,
              origin: 'MANUAL',
              type: 'CORRECTIVE',
              status: 'DRAFT',
              findingDescription: String(p.findingDescription || 'Plan sugerido por copiloto').slice(0, 2000),
              immediateCorrection: p.immediateCorrection ? String(p.immediateCorrection).slice(0, 2000) : null,
              area: p.area ? String(p.area).slice(0, 100) : null,
              process: p.process ? String(p.process).slice(0, 100) : null,
              createdById: userId,
            },
          });
        });
        return reply.code(201).send({ ok: true, kind: 'ACTION_PLAN', id: plan.id, message: `Plan de acción creado en BORRADOR` });
      }

      return reply.code(400).send({ error: `Tipo de acción no soportado: ${action.type}` });
    } catch (e: any) {
      app.log.error(e, 'copilot confirm error');
      return reply.code(500).send({ error: 'No se pudo ejecutar la acción' });
    }
  });

  // ── INGESTA DOCUMENTAL: imagen → extracción con visión ──
  app.post('/ingesta', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
      const buf = await data.toBuffer();
      if (buf.length > 8 * 1024 * 1024) return reply.code(400).send({ error: 'Máximo 8 MB' });
      const ok = (data.mimetype === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8)
        || (data.mimetype === 'image/png' && buf[0] === 0x89 && buf[1] === 0x50)
        || (data.mimetype === 'image/webp' && buf.length > 12 && buf[8] === 0x57);
      if (!ok) return reply.code(400).send({ error: 'Solo imágenes JPG/PNG/WEBP por ahora (PDF: en roadmap)' });

      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'copilot', tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[data.mimetype as string] || 'bin';
      const filename = `${Date.now()}_${randomBytes(5).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), buf);
      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      const fileUrl = `${baseUrl}/uploads/copilot/${tenantId}/${filename}`;

      // extracción con visión (llama-4-scout en Groq)
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return reply.send({ extracted: null, fileUrl, fileName: data.filename, mimeType: data.mimetype, note: 'IA no configurada: solo se guardó el archivo.' });
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            temperature: 0,
            max_tokens: 700,
            response_format: { type: 'json_object' },
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Extraé de este comprobante argentino un JSON con: tipoComprobante(FACTURA|TICKET|NOTA_CREDITO|PRESUPUESTO|OTRO), numero, puntoVenta, fecha(ISO), proveedor, cuitProveedor, neto, iva, total, moneda(ARS por defecto), concepto(descripción corta), categoria(REPARACION|REPUESTO|SERVICE|NEUMATICO|COMBUSTIBLE|OTRO), vehiculoDominio(patente si aparece). Números sin separador de miles. Null si no está. Solo JSON.' },
                { type: 'image_url', image_url: { url: `data:${data.mimetype};base64,${buf.toString('base64')}` } },
              ],
            }],
          }),
        });
        const j = await resp.json();
        const extracted = j?.choices?.[0]?.message?.content ? JSON.parse(j.choices[0].message.content) : null;
        return reply.send({ extracted, fileUrl, fileName: data.filename, mimeType: data.mimetype });
      } catch {
        return reply.send({ extracted: null, fileUrl, fileName: data.filename, mimeType: data.mimetype, note: 'No se pudo extraer con IA; completá los campos manualmente.' });
      }
    } catch (e: any) {
      app.log.error(e, 'copilot ingesta error');
      return reply.code(500).send({ error: 'Error procesando el archivo' });
    }
  });

  // ── CONFIRMAR INGESTA → crea FlotaFactura (gasto) ──
  app.post('/ingesta/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = (req as any).auth?.userId ?? null;
    const { canAct } = await resolveUserRole(prisma(), userId);
    if (!canAct) return reply.code(403).send({ error: 'Tu rol no permite cargar comprobantes' });

    const b = req.body as any;
    if (!b?.total || !b?.fileUrl) return reply.code(400).send({ error: 'Faltan datos: total y fileUrl obligatorios' });
    try {
      let vehiculoId: string | null = null;
      if (b.vehiculoDominio) {
        const v = await prisma().vehiculo.findFirst({ where: { tenantId, dominio: { contains: String(b.vehiculoDominio).replace(/\s/g, ''), mode: 'insensitive' } }, select: { id: true } });
        vehiculoId = v?.id ?? null;
      }
      const factura = await app.runWithDbContext(req, async (tx: any) =>
        tx.flotaFactura.create({
          data: {
            tenantId,
            vehiculoId,
            tipoComprobante: ['FACTURA', 'TICKET', 'NOTA_CREDITO', 'PRESUPUESTO', 'OTRO'].includes(b.tipoComprobante) ? b.tipoComprobante : 'OTRO',
            numero: b.numero ? String(b.numero) : null,
            puntoVenta: b.puntoVenta ? String(b.puntoVenta) : null,
            fecha: b.fecha && !isNaN(Date.parse(b.fecha)) ? new Date(b.fecha) : new Date(),
            proveedor: b.proveedor ? String(b.proveedor).slice(0, 120) : null,
            cuitProveedor: b.cuitProveedor ? String(b.cuitProveedor).slice(0, 20) : null,
            neto: b.neto != null ? num(b.neto) : null,
            iva: b.iva != null ? num(b.iva) : null,
            total: num(b.total),
            moneda: 'ARS',
            concepto: b.concepto ? String(b.concepto).slice(0, 300) : 'Cargado por copiloto (ingesta)',
            categoria: ['REPARACION', 'REPUESTO', 'SERVICE', 'NEUMATICO', 'COMBUSTIBLE', 'OTRO'].includes(b.categoria) ? b.categoria : 'OTRO',
            fechaVencimiento: b.fechaVencimiento && !isNaN(Date.parse(b.fechaVencimiento)) ? new Date(b.fechaVencimiento) : null,
            fileUrl: String(b.fileUrl), fileName: b.fileName ? String(b.fileName) : null, mimeType: b.mimeType ? String(b.mimeType) : null,
            notas: 'Ingesta IA — revisar contra el original adjunto.',
            uploadedById: userId,
            uploadedByNombre: 'Copiloto IA',
          },
        }));
      return reply.code(201).send({ ok: true, id: factura.id, message: `Comprobante registrado: $${fmt(factura.total)}${vehiculoId ? '' : ' (sin unidad asociada)'}` });
    } catch (e: any) {
      app.log.error(e, 'copilot ingesta confirm error');
      return reply.code(500).send({ error: 'No se pudo registrar el comprobante' });
    }
  });
}
