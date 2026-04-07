# 🚀 Motor de IA Auditora — Quick Start Guide

## 5 Pasos para Empezar

### 1️⃣ Configurar Variable de Entorno

**En `apps/api/.env`:**

```bash
# Opción A: Usar Anthropic (Recomendado)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Opción B: Usar OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Opción C: Usar Ollama (local, gratis)
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
```

### 2️⃣ Verificar que el Tenant tiene Feature Habilitada

**En la BD:**
```sql
-- Verificar que el tenant tiene ia_auditora habilitada
SELECT * FROM "TenantFeature"
WHERE "tenantId" = 'YOUR_TENANT_ID'
AND key = 'ia_auditora';
```

Si no existe, **crear:**
```sql
INSERT INTO "TenantFeature"
  ("id", "tenantId", "key", "enabled", "createdAt", "updatedAt")
VALUES
  (uuid_generate_v4(), 'YOUR_TENANT_ID', 'ia_auditora', true, now(), now());
```

### 3️⃣ Cargar Documentos y Normas

**En la UI:**

1. Ve a **Normativos** → Sube un PDF de una norma ISO
   - Sistema extrae cláusulas automáticamente
   - Status debe cambiar de PROCESSING → READY

2. Ve a **Documentos** → Crea o sube un documento
   - Debe tener contenido (text o PDF)
   - Status: EFFECTIVE preferentemente

### 4️⃣ Iniciar Análisis

**Opción A: Análisis de un Documento vs una Norma**

Ve a **Auditoría IA** → **Análisis de Cumplimiento**
1. Selecciona documento en dropdown
2. Selecciona norma en dropdown
3. Haz clic "Iniciar Análisis"
4. **Polling:** La página actualiza cada 3s
5. **Resultados:** Se muestran hallazgos en tabla

**Opción B: Auditoría Completa del Tenant**

1. En mismo página, haz clic "Auditoría Completa del Tenant"
2. Confirma (puede tardar varios minutos)
3. Sistema procesa TODOS los docs vs TODAS las normas

### 5️⃣ Chat Auditor Interactivo

Ve a **Auditoría IA** → **Chat Auditor**

1. **Sin Contexto:** Pregunta general
   - "¿Cuales son las principales brechas ISO 9001?"
   - "¿Qué controles de seguridad vial necesito?"

2. **Con Contexto:** Selecciona docs/normas específicas
   - Haz clic el botón "Contexto"
   - Checkea documentos y normas
   - La IA responde enfocada en tu contexto

---

## 🧪 Casos de Uso

### Caso 1: Auditoría Rápida

**Objetivo:** Verificar si tu manual de QA cumple ISO 9001:2015

```
1. Dashboard → Auditoría IA
2. Selecciona: documento="Manual de QA", norma="ISO 9001:2015"
3. "Iniciar Análisis"
4. Espera resultados (1-3 min)
5. Revisar: hallazgos, confianza, evidencia
6. Cambiar estado: OPEN → IN_PROGRESS → CLOSED
```

### Caso 2: Auditoría Completa

**Objetivo:** Hacer auditoría integral del tenant

```
1. Dashboard → Auditoría IA
2. Haz clic "Auditoría Completa del Tenant"
3. Confirma
4. Sistema procesa todos los docs vs todas las normas
5. Ve a Dashboard → filtra hallazgos por severidad
```

### Caso 3: Consultas de Experto

**Objetivo:** Preguntar sobre cumplimiento normativo

```
1. Chat Auditor
2. "¿Cuales son las brechas más críticas?"
3. IA responde en contexto del tenant
4. "¿Qué documentos necesito para cumplir?"
5. IA sugiere basado en disponibilidad
```

---

## 📊 Dashboard Metrics

### KPI Cards

| Card | Significado | Acción |
|------|-------------|--------|
| **Hallazgos Abiertos** | # total de issues sin resolver | Haz clic para filtrar |
| **Críticos (MUST)** | # requisitos obligatorios no cumplidos | Prioridad alta |
| **Importantes (SHOULD)** | # recomendaciones no cumplidas | Prioridad media |
| **Auditorías Completadas** | # análisis exitosos en periodo | Histórico |

### Filter & Sort

```
GET /audit/findings?status=OPEN&severity=MUST
```

Parámetros:
- `status`: OPEN | IN_PROGRESS | RESOLVED | CLOSED
- `severity`: MUST | SHOULD
- `normativeId`: UUID de norma

---

## 🔍 Interpretando Resultados

### Hallazgo Típico

```json
{
  "id": "uuid",
  "clause": "4.1",
  "title": "Política de Calidad",
  "description": "El documento no contiene política de calidad documentada",
  "evidence": "No se encontró sección 'Política de Calidad' en el manual",
  "severity": "MUST",
  "confidence": 0.92,
  "status": "OPEN",
  "suggestedActions": [
    "Crear documento 'Política de Calidad'",
    "Incluir objetivos de calidad",
    "Asegurar comunicación a todos"
  ]
}
```

### Cómo Leerlo

- **clause (4.1):** Dónde está el requisito en la norma
- **severity (MUST):** Criticidad
  - MUST = Obligatorio (rojo)
  - SHOULD = Recomendado (amarillo)
- **confidence (0.92):** Cuán seguro está la IA (92% de certeza)
- **evidence:** Qué buscó la IA
- **suggestedActions:** Qué hacer para cerrar el gap

---

## ⚙️ Configuración Avanzada

### Cambiar Modelo LLM

**Anthropic:**
```env
ANTHROPIC_MODEL=claude-opus-4-20250514
```

Opciones: claude-opus-4, claude-sonnet-4-20250514, claude-haiku

**OpenAI:**
```env
OPENAI_MODEL=gpt-4-turbo
```

Opciones: gpt-4, gpt-4-turbo, gpt-3.5-turbo

### Max Tokens

```env
AUDIT_MAX_TOKENS=8000
```

Aumentar si análisis incompleto. Disminuir si timeout.

### Batch Size

En `auditAnalysis.ts` línea 75:
```typescript
const batchSize = 15  // Cambiar aquí
```

- **Más pequeño (10):** Menos memoria, más lento
- **Más grande (20):** Más memoria, más rápido

---

## 🐛 Troubleshooting Rápido

| Problema | Causa | Solución |
|----------|-------|----------|
| "Feature not enabled" | ia_auditora deshabilitada | INSERT en TenantFeature |
| "Normative not found" | Norma no está READY | Esperar a que procese |
| "No findings" | Documento cumple perfectamente | Normal ✓ |
| "LLM not configured" | Falta ANTHROPIC_API_KEY | Añadir a .env |
| Chat sin respuesta | Contexto vacío | Seleccionar docs/normas |
| Analysis hangs | Documento muy grande | Esperar o aumentar timeout |

---

## 📈 Workflow Recomendado

```
Week 1: Carga Inicial
  └─ Sube 3-5 documentos base
  └─ Sube 2-3 normas (ISO 9001, ISO 45001, etc.)

Week 2: Auditoría Completa
  └─ Haz análisis doc vs norma para cada par crítico
  └─ Revisa hallazgos: severity + confidence
  └─ Marca OPEN → IN_PROGRESS

Week 3-4: Plan de Acción
  └─ Crea documentos para cerrar gaps
  └─ Re-audita después de cambios
  └─ Cierra hallazgos cuando estén resueltos

Month 2+: Mantenimiento
  └─ Chat auditor para preguntas rápidas
  └─ Auditoría mensual completa
  └─ Tracking de tendencias
```

---

## 💡 Pro Tips

1. **Empezar chico:** Audita 1 doc vs 1 norma primero
2. **Revisar confianza:** Prioriza hallazgos con confidence > 0.85
3. **Usar contexto:** El chat es más útil con docs/normas seleccionadas
4. **Exportar:** Hallazgos son accesibles via API en JSON
5. **Feedback:** Cambiar status ayuda a la IA a mejorar

---

## 🔗 Links Útiles

- Dashboard: `http://localhost:3000/audit`
- Análisis: `http://localhost:3000/audit/analyze`
- Chat: `http://localhost:3000/audit/chat`
- API Docs: `http://localhost:3001/docs#tag/audit`

---

**¡Listo!** 🎉 Comienza a usar el Motor de IA Auditora.
