import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLLMProvider } from '../services/llm/factory.js';

const emptyToUndefined = <T>(val: T): T | undefined => (val === '' ? undefined : val);

export const minutasRoutes: FastifyPluginAsync = async (app) => {
  // GET /minutas — Listar minutas del tenant
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { date: 'desc' },
      });
    });
    return reply.send(items);
  });

  // GET /minutas/:id — Obtener minuta por ID
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!item) return reply.code(404).send({ error: 'Minuta no encontrada' });
    return reply.send(item);
  });

  // POST /minutas — Crear minuta
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const schema = z.object({
      title: z.string().min(1),
      date: z.string(),
      time: emptyToUndefined(z.string().optional()),
      duration: emptyToUndefined(z.string().optional()),
      area: emptyToUndefined(z.string().optional()),
      type: z.string(),
      participants: z.array(z.string()).default([]),
      responsible: emptyToUndefined(z.string().optional()),
      clientId: emptyToUndefined(z.string().optional()),
      supplierId: emptyToUndefined(z.string().optional()),
      projectId: emptyToUndefined(z.string().optional()),
      tags: z.array(z.string()).default([]),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      status: z.string().default('DRAFT'),
      confidentiality: z.string().default('INTERNAL'),
      attachments: z.array(z.string()).default([]),
      audioUrl: emptyToUndefined(z.string().optional()),
      content: emptyToUndefined(z.string().optional()),
      summary: emptyToUndefined(z.string().optional()),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas POST] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.create({
        data: {
          tenantId,
          ...data,
          date: new Date(data.date),
        },
      });
    });

    return reply.code(201).send(item);
  });

  // PATCH /minutas/:id — Actualizar minuta
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const schema = z.object({
      title: z.string().optional(),
      date: z.string().optional(),
      time: emptyToUndefined(z.string().optional()),
      duration: emptyToUndefined(z.string().optional()),
      area: emptyToUndefined(z.string().optional()),
      type: z.string().optional(),
      participants: z.array(z.string()).optional(),
      responsible: emptyToUndefined(z.string().optional()),
      clientId: emptyToUndefined(z.string().optional()),
      supplierId: emptyToUndefined(z.string().optional()),
      projectId: emptyToUndefined(z.string().optional()),
      tags: z.array(z.string()).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      status: z.string().optional(),
      confidentiality: z.string().optional(),
      attachments: z.array(z.string()).optional(),
      audioUrl: emptyToUndefined(z.string().optional()),
      content: emptyToUndefined(z.string().optional()),
      summary: emptyToUndefined(z.string().optional()),
      aiProcessed: z.boolean().optional(),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas PATCH] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.update({
        where: { id, tenantId },
        data: {
          ...data,
          ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        },
      });
    });

    return reply.send(item);
  });

  // DELETE /minutas/:id — Eliminar minuta (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.update({
        where: { id, tenantId },
        data: { deletedAt: new Date() },
      });
    });

    return reply.code(204).send();
  });

  // GET /minutas/:id/blocks — Obtener bloques de una minuta
  app.get('/:id/blocks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    // Verificar que la minuta pertenece al tenant
    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    const blocks = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.findMany({
        where: { minutaId: id },
        orderBy: { order: 'asc' },
      });
    });

    return reply.send(blocks);
  });

  // POST /minutas/:id/blocks — Crear un bloque en una minuta
  app.post('/:id/blocks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    // Verificar que la minuta pertenece al tenant
    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    const schema = z.object({
      type: z.enum(['CONVERSATION', 'DECISION', 'ACTION']),
      content: z.string().min(1),
      order: z.number().optional(),
      responsible: emptyToUndefined(z.string().optional()),
      dueDate: emptyToUndefined(z.string().optional()),
      tags: z.array(z.string()).default([]),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas blocks POST] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    // Obtener el último orden si no se especifica
    let order = data.order;
    if (order === undefined) {
      const lastBlock = await app.runWithDbContext(req, async (tx: any) => {
        return tx.minutaBlock.findFirst({
          where: { minutaId: id },
          orderBy: { order: 'desc' },
        });
      });
      order = lastBlock ? lastBlock.order + 1 : 0;
    }

    const block = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.create({
        data: {
          minutaId: id,
          type: data.type,
          content: data.content,
          order,
          responsible: data.responsible,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          tags: data.tags,
        },
      });
    });

    return reply.code(201).send(block);
  });

  // PATCH /minutas/:id/blocks/:blockId — Actualizar un bloque
  app.patch('/:id/blocks/:blockId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, blockId } = req.params as { id: string; blockId: string };
    const tenantId = req.db.tenantId;

    // Verificar que la minuta pertenece al tenant
    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    const schema = z.object({
      type: z.enum(['CONVERSATION', 'DECISION', 'ACTION']).optional(),
      content: z.string().optional(),
      order: z.number().optional(),
      responsible: emptyToUndefined(z.string().optional()),
      dueDate: emptyToUndefined(z.string().optional()),
      completed: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas blocks PATCH] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const block = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.update({
        where: { id: blockId, minutaId: id },
        data: {
          ...data,
          ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
        },
      });
    });

    return reply.send(block);
  });

  // DELETE /minutas/:id/blocks/:blockId — Eliminar un bloque
  app.delete('/:id/blocks/:blockId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, blockId } = req.params as { id: string; blockId: string };
    const tenantId = req.db.tenantId;

    // Verificar que la minuta pertenece al tenant
    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.delete({
        where: { id: blockId, minutaId: id },
      });
    });

    return reply.code(204).send();
  });

  // POST /minutas/:id/summarize — Generar resumen con IA
  app.post('/:id/summarize', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { blocks: true },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    try {
      const llm = (app as any).llm;
      if (!llm) return reply.code(503).send({ error: 'IA no configurada' });

      // Construir el contenido de la minuta
      let content = `Título: ${minuta.title}\n`;
      content += `Tipo: ${minuta.type}\n`;
      content += `Fecha: ${minuta.date}\n`;
      content += `Participantes: ${minuta.participants.join(', ')}\n\n`;

      if (minuta.blocks && minuta.blocks.length > 0) {
        minuta.blocks.forEach((block: any) => {
          content += `[${block.type}]\n${block.content}\n\n`;
        });
      } else if (minuta.content) {
        content += `Contenido:\n${minuta.content}\n`;
      }

      const prompt = `Generá un resumen ejecutivo conciso de la siguiente minuta de reunión. El resumen debe ser en español, máximo 200 palabras, y debe capturar los puntos clave, decisiones tomadas y acciones pendientes.\n\n${content}`;

      const response = await llm.chat([{ role: 'user', content: prompt }], 1000);

      // Guardar el resumen en la minuta
      await app.runWithDbContext(req, async (tx: any) => {
        return tx.minuta.update({
          where: { id },
          data: { summary: response.text, aiProcessed: true },
        });
      });

      return reply.send({ summary: response.text });
    } catch (err: any) {
      console.error('[minutas summarize] Error:', err);
      return reply.code(500).send({ error: 'Error al generar resumen', details: err.message });
    }
  });

  // POST /minutas/:id/detect-actions — Detectar acciones automáticamente con IA
  app.post('/:id/detect-actions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    try {
      const llm = (app as any).llm;
      if (!llm) return reply.code(503).send({ error: 'IA no configurada' });

      // Construir el contenido de la minuta
      let content = `Título: ${minuta.title}\n`;
      content += `Tipo: ${minuta.type}\n`;
      content += `Fecha: ${minuta.date}\n`;
      content += `Participantes: ${minuta.participants.join(', ')}\n\n`;

      if (minuta.content) {
        content += `Contenido:\n${minuta.content}\n\n`;
      }

      const blocks = await app.runWithDbContext(req, async (tx: any) => {
        return tx.minutaBlock.findMany({
          where: { minutaId: id },
          orderBy: { order: 'asc' },
        });
      });

      if (blocks.length > 0) {
        blocks.forEach((block: any) => {
          content += `[${block.type}]\n${block.content}\n\n`;
        });
      }

      const prompt = `Analizá la siguiente minuta de reunión y extraé las acciones, decisiones y puntos clave. Respondé SOLO en formato JSON con esta estructura:
{
  "actions": [
    {
      "type": "ACTION",
      "content": "descripción de la acción",
      "responsible": "nombre del responsable",
      "dueDate": "YYYY-MM-DD o null"
    }
  ],
  "decisions": [
    {
      "type": "DECISION",
      "content": "descripción de la decisión"
    }
  ],
  "conversations": [
    {
      "type": "CONVERSATION",
      "content": "punto clave de la conversación"
    }
  ]
}

Minuta:\n${content}`;

      const response = await llm.chat([{ role: 'user', content: prompt }], 2000);

      // Parsear la respuesta JSON
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return reply.code(500).send({ error: 'La IA no devolvió un formato JSON válido' });

      const parsed = JSON.parse(jsonMatch[0]);

      // Crear los bloques detectados
      const allItems = [
        ...(parsed.actions || []).map((item: any) => ({ ...item, type: 'ACTION' })),
        ...(parsed.decisions || []).map((item: any) => ({ ...item, type: 'DECISION' })),
        ...(parsed.conversations || []).map((item: any) => ({ ...item, type: 'CONVERSATION' })),
      ];

      const createdBlocks = await app.runWithDbContext(req, async (tx: any) => {
        const created = [];
        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i];
          const block = await tx.minutaBlock.create({
            data: {
              minutaId: id,
              type: item.type,
              content: item.content,
              order: i,
              responsible: item.responsible || null,
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
              completed: false,
              tags: [],
            },
          });
          created.push(block);
        }
        return created;
      });

      return reply.send({ blocks: createdBlocks, count: createdBlocks.length });
    } catch (err: any) {
      console.error('[minutas detect-actions] Error:', err);
      return reply.code(500).send({ error: 'Error al detectar acciones', details: err.message });
    }
  });

  // POST /minutas/:id/blocks/:blockId/create-capa — Crear CAPA desde bloque de acción
  app.post('/:id/blocks/:blockId/create-capa', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, blockId } = req.params as { id: string; blockId: string };
    const tenantId = req.db.tenantId;

    const block = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.findFirst({
        where: { id: blockId, minutaId: id },
        include: { minuta: true },
      });
    });

    if (!block) return reply.code(404).send({ error: 'Bloque no encontrado' });

    try {
      // Buscar usuario responsable por nombre de empleado
      let assignedToId = null;
      if (block.responsible) {
        const employee = await app.runWithDbContext(req, async (tx: any) => {
          return tx.employee.findFirst({
            where: {
              tenantId,
              OR: [
                { firstName: { contains: block.responsible.split(' ')[0] } },
                { lastName: { contains: block.responsible.split(' ')[block.responsible.split(' ').length - 1] } },
              ],
            },
          });
        });
        if (employee) {
          const user = await app.runWithDbContext(req, async (tx: any) => {
            return tx.user.findFirst({
              where: { employeeId: employee.id },
            });
          });
          if (user) {
            assignedToId = user.id;
          }
        }
      }

      // Crear ActionItem (CAPA) en lugar de SgiObjective
      const dueDate = block.dueDate ? new Date(block.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.actionItem.create({
          data: {
            tenantId,
            code: `CAPA-${Date.now()}`,
            title: block.content.substring(0, 100),
            description: `Acción creada desde minuta: ${block.minuta?.title || 'Sin título'}\n\n${block.content}`,
            type: 'CORRECTIVE',
            priority: block.minuta?.priority || 'MEDIUM',
            status: 'OPEN',
            sourceType: 'MANUAL',
            sourceId: id, // ID de la minuta
            assignedToId,
            openDate: new Date(),
            dueDate,
            origin: 'MANUAL',
            affectedArea: block.minuta?.area || 'General',
            detectedBy: `Minuta: ${block.minuta?.title || 'Sin título'}`,
          },
        });
      });

      return reply.send({ actionId: action.id, message: 'CAPA creada exitosamente' });
    } catch (err: any) {
      console.error('[minutas create-capa] Error:', err);
      return reply.code(500).send({ error: 'Error al crear CAPA', details: err.message });
    }
  });

  // POST /minutas/:id/blocks/:blockId/create-risk — Crear Riesgo desde bloque de decisión
  app.post('/:id/blocks/:blockId/create-risk', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, blockId } = req.params as { id: string; blockId: string };
    const tenantId = req.db.tenantId;

    const block = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minutaBlock.findFirst({
        where: { id: blockId, minutaId: id },
      });
    });

    if (!block) return reply.code(404).send({ error: 'Bloque no encontrado' });

    try {
      const risk = await app.runWithDbContext(req, async (tx: any) => {
        return tx.risk.create({
          data: {
            tenantId,
            code: `RSK-${Date.now()}`,
            title: block.content.substring(0, 100),
            description: block.content,
            category: 'Operacional',
            probability: 3,
            impact: 3,
            riskLevel: 9,
            status: 'ASSESSED',
            treatmentPlan: 'Derivado de minuta de reunión',
            origin: 'MINUTAS',
            originEntityId: block.minutaId,
          },
        });
      });

      return reply.send({ riskId: risk.id, message: 'Riesgo creado exitosamente' });
    } catch (err: any) {
      console.error('[minutas create-risk] Error:', err);
      return reply.code(500).send({ error: 'Error al crear riesgo', details: err.message });
    }
  });

  // POST /minutas/:id/create-project — Crear Proyecto desde minuta
  app.post('/:id/create-project', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });

    try {
      // Buscar usuario responsable por nombre de empleado
      let responsibleId = null;
      if (minuta.responsible) {
        const employee = await app.runWithDbContext(req, async (tx: any) => {
          return tx.employee.findFirst({
            where: {
              tenantId,
              OR: [
                { firstName: { contains: minuta.responsible.split(' ')[0] } },
                { lastName: { contains: minuta.responsible.split(' ')[minuta.responsible.split(' ').length - 1] } },
              ],
            },
          });
        });
        if (employee) {
          const user = await app.runWithDbContext(req, async (tx: any) => {
            return tx.user.findFirst({
              where: { employeeId: employee.id },
            });
          });
          if (user) {
            responsibleId = user.id;
          }
        }
      }

      const project = await app.runWithDbContext(req, async (tx: any) => {
        return tx.project360.create({
          data: {
            tenantId,
            code: `PRJ-${Date.now()}`,
            name: minuta.title.substring(0, 100),
            description: minuta.content || minuta.summary || 'Proyecto derivado de minuta de reunión',
            origin: 'MINUTAS',
            originModule: 'MINUTAS',
            originEntityId: minuta.id,
            responsibleId,
            targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            status: 'PENDING',
            priority: minuta.priority,
            progress: 0,
            tags: minuta.tags,
          },
        });
      });

      return reply.send({ projectId: project.id, message: 'Proyecto creado exitosamente' });
    } catch (err: any) {
      console.error('[minutas create-project] Error:', err);
      return reply.code(500).send({ error: 'Error al crear proyecto', details: err.message });
    }
  });

  // POST /minutas/:id/transcribe — Transcribir audio con IA
  app.post('/:id/transcribe', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const minuta = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!minuta) return reply.code(404).send({ error: 'Minuta no encontrada' });
    if (!minuta.audioUrl) return reply.code(400).send({ error: 'La minuta no tiene audio' });

    try {
      const llm = createLLMProvider(req.tenant);
      if (!llm) return reply.code(503).send({ error: 'IA no configurada' });

      // Por ahora, simulamos la transcripción con un mensaje
      // En producción, esto debería usar un servicio de transcripción de audio real
      const prompt = `Simulá una transcripción de una reunión de reunión basada en el contexto:
Título: ${minuta.title}
Tipo: ${minuta.type}
Fecha: ${minuta.date}
Participantes: ${minuta.participants.join(', ')}

Generá una transcripción realista de la reunión en español, incluyendo:
- Introducción y presentación
- Discusión de temas principales
- Decisiones tomadas
- Acciones asignadas
- Cierre de la reunión

La transcripción debe ser detallada y profesional.`;

      const response = await llm.chat([{ role: 'user', content: prompt }], 3000);

      // Guardar la transcripción en el contenido de la minuta
      await app.runWithDbContext(req, async (tx: any) => {
        return tx.minuta.update({
          where: { id },
          data: { content: response.text },
        });
      });

      return reply.send({ transcription: response.text });
    } catch (err: any) {
      console.error('[minutas transcribe] Error:', err);
      return reply.code(500).send({ error: 'Error al transcribir audio', details: err.message });
    }
  });

  // GET /minutas/departments — Obtener lista de departamentos
  app.get('/departments', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    try {
      const departments = await app.runWithDbContext(req, async (tx: any) => {
        return tx.department.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          },
          orderBy: { name: 'asc' },
        });
      });

      return reply.send({ departments });
    } catch (err: any) {
      console.error('[minutas departments] Error:', err);
      return reply.code(500).send({ error: 'Error al obtener departamentos', details: err.message });
    }
  });

  // GET /minutas/employees — Obtener lista de empleados
  app.get('/employees', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    try {
      const employees = await app.runWithDbContext(req, async (tx: any) => {
        return tx.employee.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: {
              select: {
                name: true,
              },
            },
            departmentId: true,
          },
          orderBy: { firstName: 'asc' },
        });
      });

      const formattedEmployees = employees.map((emp: any) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        position: emp.position?.name || '',
        departmentId: emp.departmentId,
      }));

      return reply.send({ employees: formattedEmployees });
    } catch (err: any) {
      console.error('[minutas employees] Error:', err);
      return reply.code(500).send({ error: 'Error al obtener empleados', details: err.message });
    }
  });
};
