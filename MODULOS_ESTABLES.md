# Módulos Estables - SGI 360

> **ADVERTENCIA**: Los siguientes módulos han sido verificados y están funcionando correctamente.  
> **NO MODIFICAR** salvo que sea absolutamente necesario y previa autorización.

---

## Módulos Estabilizados

### 1. Documentos (`/documents`)
**Estado**: ✅ Estable y funcionando  
**Última verificación**: 2026-04-03

**Funcionalidades operativas:**
- CRUD completo de documentos
- Subida de archivos PDF/DOCX/XLSX
- Extracción automática de contenido de archivos
- Vinculación de cláusulas normativas (clause mappings)
- Gestión de versiones (versionado automático)
- Descarga de archivos
- Asignación a departamentos y normativas

**Endpoints críticos:**
- `GET /documents/:id` - Incluye content, filePath, fileUrl, createdBy, updatedBy
- `POST /documents/:id/clause-mappings` - Vinculación de cláusulas
- `PATCH /documents/:id` - Actualización con validación flexible de UUIDs

**Archivos clave:**
- `apps/api/src/routes/documents.ts`
- `apps/api/src/routes/normativos.ts` (clauseMappingRoutes)
- `apps/web/src/app/(app)/documents/[id]/page.tsx`

**Notas técnicas:**
- Schema Zod acepta `null` y string vacío para departmentId/normativeId
- Extracción automática de contenido si es NULL en BD pero existe archivo
- apiFetch usa `json` en lugar de `body` para Content-Type correcto

---

### 2. Normativos (`/normativos`)
**Estado**: ✅ Estable y funcionando  
**Última verificación**: 2026-04-03

**Funcionalidades operativas:**
- CRUD de normativas
- Subida de normas (PDF)
- Procesamiento automático de PDFs
- Gestión de cláusulas (extraídas automáticamente)
- **Soft delete** con posibilidad de re-upload
- **Nueva revisión** de normas (archiva versión anterior)
- **Eliminación** de normas

**Endpoints críticos:**
- `POST /normativos/upload` - Permite re-upload de normas soft-deleted
- `DELETE /normativos/:id` - Soft delete
- `POST /normativos/:id/revision` - Crear nueva revisión

**Archivos clave:**
- `apps/api/src/routes/normativos.ts`

**Notas técnicas:**
- Eliminación permanente previa antes de crear nueva norma con mismo código
- Corrección de mensaje de error P2002 para duplicados de NormativeStandard

---

### 3. Auditoría IA (`/audit`)
**Estado**: ✅ **BLINDADO** - Estable y funcionando  
**Última verificación**: 2026-04-03 13:14  
**NO MODIFICAR** - Todas las funcionalidades operativas

**Funcionalidades operativas:**
- Análisis documento vs normativa
- Lista de documentos y normativas disponibles
- Procesamiento asíncrono de análisis
- Visualización de resultados de auditoría
- **Eliminar hallazgos individuales** (soft delete) - ✅ Verificado
- Convertir hallazgos a No Conformidades (NCR) - ✅ Verificado
- Chat con contexto de auditoría
- Dashboard con estadísticas
- Auditoría completa del tenant

**Endpoints críticos (NO MODIFICAR):**
```
POST   /audit/analyze                 - Iniciar análisis documento vs norma
GET    /audit/runs/:runId             - Estado de ejecución
GET    /audit/runs/:runId/findings    - Hallazgos del análisis
DELETE /audit/findings/:id            - Eliminar hallazgo ⚠️ USAR :id NO :findingId
POST   /audit/findings/:findingId/convert-to-ncr  - Convertir a NCR
POST   /audit/chat                    - Chat con contexto
GET    /audit/findings?status=OPEN    - Listar hallazgos abiertos
```

**Archivos clave (NO MODIFICAR):**
- `apps/api/src/routes/audit.ts` - Todas las rutas de Auditoría IA
- `apps/api/src/app.ts` - Registro con prefijo `/audit` (línea 120)
- `apps/web/src/app/(app)/audit/page.tsx` - Dashboard con hallazgos abiertos
- `apps/web/src/app/(app)/audit/analyze/page.tsx` - Análisis y resultados

**Notas técnicas críticas:**
- Prefijo de rutas: `/audit` (registrado en app.ts línea 120)
- Schema Zod `findingIdSchema` usa `id` (NO `findingId`)
- DELETE endpoint usa `/findings/:id` (corregido de `:findingId`)
- Soft delete implementado en todos los endpoints de eliminación
- CSRF token requerido para DELETE/POST/PATCH
- Usa cola de procesamiento (`auditJobs.ts`)
- Integración con LLM para análisis

---

## Registro de Rutas en app.ts

Las siguientes rutas están registradas y no deben modificarse:

```typescript
// Importaciones (líneas 16-40)
import { auditRoutes } from './routes/audit.js';              // Auditoría IA
import { registerAuditRoutes } from './routes/audits.js';     // Auditorías ISO
import { clauseMappingRoutes } from './routes/normativos.js'; // Vinculación cláusulas
import { departmentRoutes } from './routes/departments.js';     // Departamentos

// Registros (líneas 114-137)
await app.register(auditRoutes, { prefix: '/audit' });        // ← CRÍTICO
await app.register(registerAuditRoutes);                        // Auditorías ISO (sin prefijo)
await app.register(clauseMappingRoutes, { prefix: '/documents' });
await app.register(departmentRoutes, { prefix: '/departments' });
```

---

## Cambios que NO deben realizarse

1. **NO** modificar schemas Zod en rutas estables sin verificación exhaustiva
2. **NO** cambiar prefijos de rutas registradas
3. **NO** eliminar imports de rutas en `app.ts`
4. **NO** modificar lógica de extracción de contenido en documentos
5. **NO** alterar manejo de soft-delete en normativos

---

## Si se requiere modificar algún módulo estable

1. Verificar impacto en otros módulos
2. Crear backup/branch antes de modificar
3. Documentar el cambio en esta sección
4. Probar exhaustivamente todas las funcionalidades afectadas

---

**Documento generado**: 2026-04-03  
**Responsable**: Cascade AI
