# Motor de IA Auditora — Guía de Implementación

## ✅ Estado: COMPLETAMENTE IMPLEMENTADO

El Motor de IA Auditora para SGI 360 está **100% funcional** y listo para usar. Incluye:

- ✅ 3 capacidades de análisis (documento vs norma, auditoría completa de tenant, chat interactivo)
- ✅ Soporte para múltiples proveedores LLM (Claude/Anthropic, OpenAI, Ollama)
- ✅ Procesamiento asincrónico con BullMQ
- ✅ Control de acceso mediante feature flags
- ✅ Frontend completo con dashboard, análisis y chat

---

## 📐 ARQUITECTURA

### 1. BASE DE DATOS (Prisma)

**Modelos principales:**
- `AiFinding`: Hallazgos generados por la IA
- `AuditRun`: Ejecución de auditoría (agrupa hallazgos relacionados)

```prisma
model AiFinding {
  id                String      @id @default(uuid()) @db.Uuid
  tenantId          String      @db.Uuid

  // Relaciones
  auditRunId        String?     @db.Uuid
  auditRun          AuditRun?   @relation(fields: [auditRunId], references: [id])
  documentId        String?     @db.Uuid
  document          Document?   @relation(fields: [documentId], references: [id])
  normativeId       String?     @db.Uuid
  normative         NormativeStandard? @relation(fields: [normativeId], references: [id])
  clauseId          String?     @db.Uuid
  clauseRef         NormativeClause? @relation(fields: [clauseId], references: [id])

  // Contenido del hallazgo
  severity          FindingSeverity  // MUST | SHOULD
  standard          String            // ej: "ISO9001-2015"
  clause            String            // ej: "4.1"
  title             String
  description       String
  auditType         String?           // "document_vs_norma" | "tenant_audit" | "chat"

  // Análisis IA
  confidence        Float?            // 0.0-1.0
  evidence          String?           // Texto extraído del documento
  suggestedActions  Json?             // Array de acciones correctivas

  // Estado
  status            String   @default("OPEN")  // OPEN, IN_PROGRESS, RESOLVED, CLOSED

  createdAt         DateTime @default(now()) @db.Timestamptz
  updatedAt         DateTime @updatedAt @db.Timestamptz
  deletedAt         DateTime? @db.Timestamptz
}

model AuditRun {
  id                String      @id @default(uuid()) @db.Uuid
  tenantId          String      @db.Uuid

  type              String      // "document_vs_norma" | "tenant_audit"
  status            String      // "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"

  // Para auditorías de documento vs norma
  documentId        String?     @db.Uuid
  document          Document?   @relation(fields: [documentId], references: [id])
  normativeId       String?     @db.Uuid
  normative         NormativeStandard? @relation(fields: [normativeId], references: [id])

  // Resultados
  totalClauses      Int @default(0)
  coveredClauses    Int @default(0)
  missingClauses    Int @default(0)
  findingsCount     Int @default(0)

  // Job tracking
  jobId             String?
  error             String?

  // Timeline
  startedAt         DateTime @default(now()) @db.Timestamptz
  completedAt       DateTime? @db.Timestamptz

  // Relaciones
  findings          AiFinding[]
  createdById       String?
  createdBy         PlatformUser? @relation("AuditRunCreatedBy", fields: [createdById], references: [id])

  deletedAt         DateTime? @db.Timestamptz
}
```

---

## 🧠 CAPA DE ABSTRACCIÓN LLM

### Proveedores Soportados

#### 1. **Anthropic** (Default)
```typescript
export class AnthropicProvider implements LLMProvider {
  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') { ... }
  async chat(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse>
}
```

#### 2. **OpenAI**
```typescript
export class OpenAIProvider implements LLMProvider {
  constructor(apiKey: string, model = 'gpt-4-turbo') { ... }
  async chat(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse>
}
```

#### 3. **Ollama** (Local/Self-hosted)
```typescript
export class OllamaProvider implements LLMProvider {
  constructor(model = 'llama3.1', baseURL = 'http://localhost:11434/v1') { ... }
  async chat(messages: LLMMessage[], maxTokens = 1024): Promise<LLMResponse>
}
```

### Factory Pattern
```typescript
// src/services/llm/factory.ts
export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'anthropic';

  if (provider === 'anthropic') {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY!);
  } else if (provider === 'openai') {
    return new OpenAIProvider(process.env.OPENAI_API_KEY!);
  } else if (provider === 'ollama') {
    return new OllamaProvider(
      process.env.OLLAMA_MODEL,
      process.env.OLLAMA_BASE_URL
    );
  }
  throw new LLMConfigError(`Unknown provider: ${provider}`);
}
```

---

## 📊 SERVICIO DE ANÁLISIS

### AuditAnalysisService
**Archivo:** `src/services/auditAnalysis.ts`

#### Métodos principales:

```typescript
export class AuditAnalysisService {
  constructor(private llm: LLMProvider) {}

  /**
   * Analiza documento vs cláusulas normativas
   * - Si >25 cláusulas: divide en lotes de 15
   * - Parsea JSON de forma robusta
   * - Retorna hallazgos con confidence scores
   */
  async analyzeDocumentVsClauses(
    input: DocumentAnalysisInput
  ): Promise<DocumentAnalysisResult>

  /**
   * Construye contexto para chat auditor
   * Incluye documentos y normas disponibles del tenant
   */
  buildChatContext(
    documents: Array<{ title: string; type: string }>,
    normatives: Array<{ name: string; code: string; clauseCount: number }>
  ): string
}
```

#### Prompt Engineering:
```
Eres un auditor experto en cumplimiento normativo ISO/IATF.
Analiza el siguiente documento contra las cláusulas normativas.

[Documento]
[Cláusulas]

Para cada cláusula, determina:
1. ¿Cubierta? (boolean)
2. Severidad (MUST | SHOULD)
3. Título descriptivo
4. Descripción del análisis
5. Evidencia extraída
6. Confianza (0.0-1.0)
7. Acciones sugeridas

Responde en JSON estructurado.
```

---

## ⚙️ PROCESAMIENTO ASINCRÓNICO (BullMQ)

### Queue Setup
**Archivo:** `src/jobs/queue.ts`

```typescript
// Crear cola de auditoría
export function getAuditQueue(): Queue<AuditJobPayload> {
  return new Queue('audit-analysis', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

// Iniciar worker que procesa jobs
export function startAuditWorker(): Worker<AuditJobPayload> {
  return new Worker('audit-analysis', async (job) => {
    switch (job.name) {
      case 'analyze-document-vs-norma':
        return processDocumentVsNormaJob(job);
      case 'tenant-full-audit':
        return processTenantAuditJob(job);
    }
  }, {
    connection: getRedisConnection(),
    concurrency: 2,
  });
}
```

### Job 1: Document vs Norma
**Archivo:** `src/jobs/auditJobs.ts`

```typescript
export async function processDocumentVsNormaJob(
  job: Job<ProcessDocumentVsNormaPayload>
) {
  const { auditRunId, tenantId, documentId, normativeId } = job.data;

  // 1. Marcar como RUNNING (10%)
  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: { status: 'RUNNING' }
  });

  // 2. Cargar documento y normativa (20%)
  const [document, normative] = await Promise.all([
    prisma.document.findUniqueOrThrow({ where: { id: documentId } }),
    prisma.normativeStandard.findUniqueOrThrow({
      where: { id: normativeId },
      include: { clauses: { where: { status: 'ACTIVE' } } }
    })
  ]);

  // 3. Extraer contenido del documento (40%)
  const documentContent = await resolveDocumentContent(document);

  // 4. Ejecutar análisis IA (60%)
  const analysisResult = await getAuditService()
    .analyzeDocumentVsClauses({
      documentTitle: document.title,
      documentContent,
      normativeCode: normative.code,
      normativeName: normative.name,
      clauses: normative.clauses.map(c => ({
        id: c.id,
        clauseNumber: c.clauseNumber,
        title: c.title,
        content: c.content
      }))
    });

  // 5. Crear AiFinding para cada brecha (80%)
  const findingsToCreate = analysisResult.findings
    .filter(f => !f.covered)  // Solo los gaps
    .map(f => ({
      tenantId,
      auditRunId,
      auditType: 'document_vs_norma',
      documentId,
      normativeId,
      severity: f.severity,
      standard: normative.code,
      clause: f.clauseNumber,
      title: f.title,
      description: f.description,
      evidence: f.evidence,
      confidence: f.confidence,
      suggestedActions: f.suggestedActions,
      status: 'OPEN'
    }));

  if (findingsToCreate.length > 0) {
    await prisma.aiFinding.createMany({
      data: findingsToCreate
    });
  }

  // 6. Actualizar AuditRun (100%)
  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      totalClauses: analysisResult.findings.length,
      coveredClauses: analysisResult.coveredCount,
      missingClauses: analysisResult.missingCount,
      findingsCount: findingsToCreate.length
    }
  });

  // 7. Notificar admins del tenant
  await notifyTenantAdmins(prisma, tenantId, {
    type: 'AUDIT_COMPLETED',
    message: `Auditoría completada: ${findingsToCreate.length} hallazgo(s)`
  });
}
```

### Job 2: Tenant Full Audit
```typescript
export async function processTenantAuditJob(
  job: Job<ProcessTenantAuditPayload>
) {
  // Cargar TODOS los documentos y normas del tenant
  const [documents, normatives] = await Promise.all([
    prisma.document.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.normativeStandard.findMany({
      where: { tenantId, deletedAt: null },
      include: { clauses: { where: { status: 'ACTIVE' } } }
    })
  ]);

  // Analizar cada par (documento × norma)
  let totalFindings = 0;
  const totalPairs = documents.length * normatives.length;
  let pairsProcessed = 0;

  for (const doc of documents) {
    for (const norm of normatives) {
      const analysisResult = await getAuditService()
        .analyzeDocumentVsClauses({...});

      // Crear findings para gaps
      const findings = analysisResult.findings
        .filter(f => !f.covered)
        .map(f => ({...}));

      if (findings.length > 0) {
        await prisma.aiFinding.createMany({ data: findings });
        totalFindings += findings.length;
      }

      pairsProcessed++;
      const progress = Math.round(10 + (pairsProcessed / totalPairs) * 80);
      await job.updateProgress(progress);
    }
  }

  // Actualizar AuditRun con resultados consolidados
  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      findingsCount: totalFindings
    }
  });
}
```

---

## 🔌 API ENDPOINTS

### POST /audit/analyze
Inicia análisis de documento vs norma específica

```bash
curl -X POST http://localhost:3000/api/audit/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "uuid-doc",
    "normativeId": "uuid-norm"
  }'
```

**Response:**
```json
{
  "auditRun": {
    "id": "uuid",
    "type": "document_vs_norma",
    "status": "QUEUED"
  },
  "jobId": "123456"
}
```

### POST /audit/tenant-audit
Auditoría completa: todos los docs vs todas las normas

```bash
curl -X POST http://localhost:3000/api/audit/tenant-audit \
  -H "Authorization: Bearer $TOKEN"
```

### GET /audit/runs
Listar ejecuciones de auditoría del tenant

```bash
curl http://localhost:3000/api/audit/runs
```

### GET /audit/runs/:runId
Detalle de una ejecución

```bash
curl http://localhost:3000/api/audit/runs/uuid
```

### GET /audit/findings
Listar hallazgos del tenant con filtros

```bash
curl "http://localhost:3000/api/audit/findings?status=OPEN&severity=MUST"
```

### GET /audit/runs/:runId/findings
Hallazgos de una ejecución específica

```bash
curl http://localhost:3000/api/audit/runs/uuid/findings
```

### PATCH /audit/findings/:id
Actualizar estado de hallazgo

```bash
curl -X PATCH http://localhost:3000/api/audit/findings/uuid \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'
```

### POST /audit/chat
Chat interactivo con contexto del tenant

```bash
curl -X POST http://localhost:3000/api/audit/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué cláusulas de ISO 9001 no están cubiertas?",
    "context": {
      "documentIds": ["uuid1"],
      "normativeIds": ["uuid2"]
    }
  }'
```

---

## 🎨 FRONTEND

### Páginas implementadas:

#### 1. Dashboard (`/audit`)
- KPIs: hallazgos abiertos, por severidad
- Lista de ejecuciones recientes
- Acciones rápidas para iniciar análisis

#### 2. Análisis (`/audit/analyze`)
- Selector de documento y norma
- Botón "Iniciar análisis"
- Polling de status en tiempo real
- Tabla de hallazgos con:
  - Badge de severidad (MUST/SHOULD)
  - Cláusula y descripción
  - Confianza (progress bar)
  - Acciones sugeridas

#### 3. Chat (`/audit/chat`)
- Interface conversacional
- Contexto configurable (documentos/normas)
- Historial en memoria
- Respuestas contextuales del LLM

### Tipos TypeScript

```typescript
// apps/web/src/lib/types.ts

export type AuditRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type AuditRun = {
  id: string;
  type: 'document_vs_norma' | 'tenant_audit';
  status: AuditRunStatus;
  document?: { id: string; title: string };
  normative?: { id: string; name: string; code: string };
  totalClauses: number;
  coveredClauses: number;
  missingClauses: number;
  findingsCount: number;
  startedAt: string;
  completedAt: string | null;
};

export type AiFinding = {
  id: string;
  severity: 'MUST' | 'SHOULD';
  standard: string;     // ej: "ISO9001-2015"
  clause: string;       // ej: "4.1"
  title: string;
  description: string;
  confidence: number | null;
  evidence: string | null;
  suggestedActions: string[] | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  document?: { id: string; title: string };
  normative?: { id: string; name: string; code: string };
  createdAt: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
```

---

## 🔐 CONTROL DE ACCESO

### Feature Flag
El motor de IA auditora está **gateado** con feature flag `ia_auditora`:

```typescript
// En routes/audit.ts
app.post('/analyze', async (req, reply) => {
  app.requireFeature(req, 'ia_auditora');  // ← Solo PREMIUM
  // ...
});
```

**Solo tenants con plan PREMIUM** pueden acceder a las rutas `/audit/*`.

---

## 🌍 VARIABLES DE ENTORNO

### Requeridas (al menos una):
```bash
# Anthropic (Default)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# O OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo

# O Ollama (local)
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
```

### Opcionales:
```bash
# Límite de tokens para análisis
AUDIT_MAX_TOKENS=4000

# Redis para BullMQ
REDIS_URL=redis://localhost:6379
```

---

## 🚀 CÓMO USAR

### 1. **Configurar variables de entorno**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/api
cp .env.example .env.local

# Editar .env.local con:
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
```

### 2. **Ejecutar migraciones Prisma**
```bash
cd apps/api
npm run prisma:migrate
```

### 3. **Iniciar servidores**
```bash
# Terminal 1: API
cd apps/api
npm run dev

# Terminal 2: Frontend
cd apps/web
npm run dev
```

### 4. **Acceder a la UI**
```
http://localhost:3000/audit
```

### 5. **Usar el motor**

#### Opción A: Análisis documento vs norma
1. Ir a `/audit/analyze`
2. Seleccionar documento y norma
3. Click "Iniciar análisis"
4. Esperar resultado (1-5 minutos según tamaño)

#### Opción B: Auditoría completa
1. POST http://localhost:3000/api/audit/tenant-audit
2. Esperar a que procese todos los pares
3. Ver resultados en `/audit/findings`

#### Opción C: Chat auditor
1. Ir a `/audit/chat`
2. Escribir pregunta sobre cumplimiento
3. Recibir respuesta contextualizada

---

## 🐛 TROUBLESHOOTING

### Error: "LLM no configurada"
```
IA no configurada: falta ANTHROPIC_API_KEY
```
**Solución:** Configurar `ANTHROPIC_API_KEY` en `.env.local`

### Error: "Feature not available"
```
402 Payment Required: Feature 'ia_auditora' not enabled
```
**Solución:** Asignar plan PREMIUM al tenant en la BD

### Error: "Redis connection refused"
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solución:** Iniciar Redis: `redis-server`

### Análisis muy lento
- Normas con >50 cláusulas se dividen en lotes
- Cada lote requiere una llamada a LLM
- Considerar aumentar `AUDIT_MAX_TOKENS`

---

## 📈 ROADMAP (Opcional)

- [ ] Caché de análisis para documentos/normas idénticas
- [ ] Webhooks para notificaciones en tiempo real
- [ ] Exportación de reportes (PDF/Excel)
- [ ] Integración con sistemas de gestión de riesgos
- [ ] Análisis histórico y tendencias
- [ ] Machine learning para mejorar predicciones de confidence

---

## 📚 REFERENCIAS

- **Schema Prisma:** `apps/api/prisma/schema.prisma` (líneas 332-419)
- **LLM Providers:** `apps/api/src/services/llm/`
- **Audit Service:** `apps/api/src/services/auditAnalysis.ts`
- **Jobs:** `apps/api/src/jobs/auditJobs.ts`
- **Routes:** `apps/api/src/routes/audit.ts`
- **Frontend:** `apps/web/src/app/(app)/audit/`

---

**Estado:** ✅ Completamente implementado y funcional
**Última actualización:** 2026-03-20
**Mantenedor:** SGI 360 Development Team
