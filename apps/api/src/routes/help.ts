import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLLMProvider } from '../services/llm/factory.js';
import { availableTools, executeTool } from '../services/assistant-tools.js';

const AskSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    module: z.string().optional(),
    subModule: z.string().optional(),
    screen: z.string().optional(),
    pathname: z.string().optional(),
  }).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export async function registerHelpRoutes(app: FastifyInstance) {
  // Endpoint de streaming SSE para respuestas tipo chat
  app.post('/ask/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const parsed = AskSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.errors });
      }

      const { message, context, history = [] } = parsed.data;
      const ctx = context || {};
      const moduleName = ctx.module || detectModuleFromPath(ctx.pathname || '/');
      const screenName = ctx.screen || ctx.subModule || moduleName;

      const systemPrompt = buildSystemPrompt(moduleName, screenName);

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: `[Contexto del sistema]\n${systemPrompt}\n\n[Pregunta del usuario]` },
        ...history.slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message },
      ];

      const llm = createLLMProvider(req.tenant);

      // Verificar si soporta streaming
      if (!llm.chatStream) {
        // Fallback a respuesta normal
        const result = await llm.chat(messages, 1500);
        return reply.send({
          response: result.text,
          context: { module: moduleName, screen: screenName },
          tokensUsed: result.tokensUsed,
          model: result.model,
          stream: false,
        });
      }

      // Configurar headers para SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Enviar metadata inicial
      reply.raw.write(`data: ${JSON.stringify({ type: 'meta', module: moduleName, screen: screenName })}\n\n`);

      // Stream de la respuesta
      let fullText = '';
      for await (const chunk of llm.chatStream(messages, 1500)) {
        if (chunk.done) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
        } else {
          fullText += chunk.text;
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
        }
      }

      reply.raw.end();
    } catch (err: any) {
      if (err?.code === 'LLM_NOT_CONFIGURED' || err?.statusCode === 503) {
        return reply.code(503).send({
          error: 'IA no configurada',
          response: 'El asistente de IA no está disponible. Contacte al administrador para configurar OpenAI u Ollama.',
        });
      }
      app.log.error(err);
      return reply.code(500).send({ error: err?.message || 'Error del asistente' });
    }
  });

  // Endpoint tradicional con Function Calling pragmático
  app.post('/ask', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const parsed = AskSchema.safeParse(body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', details: parsed.error.errors });
      }

      const { message, context, history = [] } = parsed.data;
      const ctx = context || {};
      const moduleName = ctx.module || detectModuleFromPath(ctx.pathname || '/');
      const screenName = ctx.screen || ctx.subModule || moduleName;

      // Detectar intención y ejecutar herramientas si aplica
      const toolResult = await detectAndExecuteTool(message, moduleName, req);

      const systemPrompt = buildSystemPrompt(moduleName, screenName, toolResult);

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: `[Contexto del sistema]\n${systemPrompt}\n\n[Pregunta del usuario]` },
        ...history.slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message },
      ];

      const llm = createLLMProvider(req.tenant);
      const result = await llm.chat(messages, 1500);

      return reply.send({
        response: result.text,
        context: { module: moduleName, screen: screenName },
        tokensUsed: result.tokensUsed,
        model: result.model,
        toolUsed: toolResult?.toolName || null,
      });
    } catch (err: any) {
      if (err?.code === 'LLM_NOT_CONFIGURED' || err?.statusCode === 503) {
        return reply.code(503).send({
          error: 'IA no configurada',
          response: 'El asistente de IA no está disponible. Contacte al administrador para configurar OpenAI u Ollama.',
        });
      }
      app.log.error(err);
      return reply.code(500).send({ error: err?.message || 'Error del asistente' });
    }
  });

  app.get('/modules', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ modules: moduleList });
  });
}

function detectModuleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'inicio';
  const first = segments[0].toLowerCase();
  const map: Record<string, string> = {
    dashboard: 'inicio',
    project360: 'project360',
    'contexto-sgi': 'contexto',
    objetivos: 'objetivos',
    rrhh: 'rrhh',
    capacitaciones: 'capacitaciones',
    clientes: 'clientes',
    proveedores: 'proveedores',
    cumplimiento: 'cumplimiento',
    documents: 'documentos',
    seguridad: 'seguridad',
    indicadores: 'indicadores',
    calidad: 'calidad',
    auditoria: 'auditorias',
    auditorias: 'auditorias',
    'revision-direccion': 'revision-direccion',
    infraestructura: 'infraestructura',
    reportes: 'reportes',
    configuracion: 'configuracion',
    integraciones: 'integraciones',
    notificaciones: 'notificaciones',
    acciones: 'acciones',
    activos: 'activos',
    ambientales: 'ambientales',
    calibraciones: 'calibraciones',
    'gestion-cambios': 'gestion-cambios',
    incidentes: 'incidentes',
    iperc: 'iperc',
    legales: 'legales',
    licencia: 'licencia',
    licencias: 'licencias',
    mantenimiento: 'mantenimiento',
    normativos: 'normativos',
    'no-conformidades': 'no-conformidades',
    planes: 'planes',
    proyectos: 'proyectos',
    riesgos: 'riesgos',
    simulacros: 'simulacros',
    stakeholders: 'stakeholders',
    contexto: 'contexto',
    admin: 'admin',
  };
  return map[first] || first;
}

function buildSystemPrompt(moduleName: string, screenName: string, toolResult?: { toolName: string; summary: string } | null): string {
  let toolContext = '';
  if (toolResult) {
    toolContext = `\n\n## Datos del sistema (consulta automática)\n${toolResult.summary}\n\nUsá estos datos reales para responder la pregunta del usuario. No inventes información adicional.`;
  }

  return `Sos un asistente de ayuda experto del sistema SGI 360 (Sistema de Gestión Integral). Respondé siempre en español, claro y conciso. Usá listas numeradas para pasos, negrita para conceptos clave.

## Contexto actual
- Módulo: ${moduleName}
- Pantalla: ${screenName}${toolContext}

## Reglas
1. Si pregunta cómo usar una funcionalidad: pasos numerados.
2. Si pregunta qué hace un campo: explicá propósito y datos esperados.
3. Si pregunta efecto de una acción: explicá flujo completo e impacto en otros módulos.
4. Incluí siempre una recomendación o buena práctica al final.
5. Si no tenés información específica, orientá al Centro de Ayuda (/modo-de-uso).
6. Nunca inventés datos de la empresa del usuario.`;
}

async function detectAndExecuteTool(
  message: string,
  moduleName: string,
  req: FastifyRequest
): Promise<{ toolName: string; summary: string } | null> {
  const msg = message.toLowerCase();
  const tenantId = req.headers['x-tenant-id'] as string || req.db?.tenantId;
  if (!tenantId) return null;

  const prisma = (req.server as any).prisma;
  if (!prisma) return null;

  const ctx = { prisma, tenantId, userId: req.auth?.userId };

  // Detectar intenciones por módulo y palabras clave
  if (msg.includes('norma') || msg.includes('normativ') || msg.includes('iso') || msg.includes('cláusula')) {
    const result = await executeTool('query_normativos', { limit: 10 }, ctx);
    if (result.success) return { toolName: 'query_normativos', summary: result.summary || '' };
  }

  if (msg.includes('no conformidad') || msg.includes('nc') || msg.includes('ncr') || msg.includes('disconformidad')) {
    const result = await executeTool('query_nc', { limit: 5 }, ctx);
    if (result.success) return { toolName: 'query_nc', summary: result.summary || '' };
  }

  if (msg.includes('documento') || msg.includes('archivo') || msg.includes('procedimiento') || msg.includes('instrucción')) {
    const result = await executeTool('query_documents', { limit: 5 }, ctx);
    if (result.success) return { toolName: 'query_documents', summary: result.summary || '' };
  }

  if (msg.includes('indicador') || msg.includes('kpi') || msg.includes('métrica') || msg.includes('medición')) {
    const result = await executeTool('query_indicators', { limit: 5 }, ctx);
    if (result.success) return { toolName: 'query_indicators', summary: result.summary || '' };
  }

  if (msg.includes('auditoría') || msg.includes('audit') || msg.includes('revisión')) {
    const result = await executeTool('query_audits', { limit: 5 }, ctx);
    if (result.success) return { toolName: 'query_audits', summary: result.summary || '' };
  }

  if (msg.includes('cumplimiento') || msg.includes('compliance') || msg.includes('cumple')) {
    const result = await executeTool('query_compliance', {}, ctx);
    if (result.success) return { toolName: 'query_compliance', summary: result.summary || '' };
  }

  return null;
}

const moduleList = [
  { id: 'inicio', name: 'Inicio / Dashboard', icon: 'LayoutDashboard' },
  { id: 'auditorias', name: 'Auditorías', icon: 'ClipboardCheck' },
  { id: 'riesgos', name: 'Riesgos', icon: 'Shield' },
  { id: 'documentos', name: 'Documentos', icon: 'FileText' },
  { id: 'indicadores', name: 'Indicadores', icon: 'TrendingUp' },
  { id: 'rrhh', name: 'RRHH', icon: 'Users' },
  { id: 'capacitaciones', name: 'Capacitaciones', icon: 'GraduationCap' },
  { id: 'no-conformidades', name: 'No Conformidades', icon: 'AlertTriangle' },
  { id: 'gestion-cambios', name: 'Gestión de Cambios', icon: 'Settings' },
  { id: 'acciones', name: 'Acciones Correctivas', icon: 'CheckCircle' },
  { id: 'incidentes', name: 'Incidentes', icon: 'AlertOctagon' },
  { id: 'simulacros', name: 'Simulacros', icon: 'Flame' },
  { id: 'mantenimiento', name: 'Mantenimiento', icon: 'Wrench' },
  { id: 'clientes', name: 'Clientes', icon: 'Headphones' },
  { id: 'proveedores', name: 'Proveedores', icon: 'Truck' },
  { id: 'cumplimiento', name: 'Cumplimiento', icon: 'BookOpen' },
  { id: 'normativos', name: 'Normativos', icon: 'Scale' },
  { id: 'project360', name: 'Project360', icon: 'BarChart3' },
  { id: 'reportes', name: 'Reportes', icon: 'FileBarChart' },
  { id: 'configuracion', name: 'Configuración', icon: 'Settings' },
  { id: 'contexto', name: 'Contexto del SGI', icon: 'Compass' },
  { id: 'objetivos', name: 'Objetivos', icon: 'Target' },
  { id: 'infraestructura', name: 'Infraestructura', icon: 'Package' },
  { id: 'calidad', name: 'Calidad / Mejora', icon: 'Award' },
  { id: 'seguridad', name: 'Seguridad & Ambiente', icon: 'ShieldAlert' },
  { id: 'activos', name: 'Activos', icon: 'Box' },
  { id: 'calibraciones', name: 'Calibraciones', icon: 'Gauge' },
  { id: 'iperc', name: 'IPERC', icon: 'Search' },
  { id: 'legales', name: 'Legales', icon: 'Gavel' },
  { id: 'stakeholders', name: 'Partes Interesadas', icon: 'Users' },
  { id: 'planes', name: 'Planes', icon: 'ClipboardList' },
  { id: 'admin', name: 'Administración', icon: 'Lock' },
];
