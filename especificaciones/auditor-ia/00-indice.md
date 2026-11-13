# Auditor IA — Índice

> Estado: **especificación**. No hay código implementado. Ubicación: `especificaciones/auditor-ia/` (`docs/` está en `.gitignore`).

## Documentos y orden de lectura

| # | Archivo | Contenido |
|---|---|---|
| 1 | `00-indice.md` | Alcance, decisiones y mapa |
| 2 | `01-funcional.md` | Pantallas, flujos, estados, permisos, reglas |
| 3 | `02-arquitectura-contratos.md` | Inventario del repositorio (observado), arquitectura, datos, API, conectores, esquemas de IA |
| 4 | `03-plan-implementacion.md` | Checklist por dependencias, criterios de aceptación, pruebas, despliegue |
| 5 | `04-decisiones-pendientes.md` | Decisiones abiertas con recomendación |

## Alcance v1

- **Incluye:** evaluación de requisitos de una norma cargada en Normativos contra evidencias del sistema, validación humana, borradores de hallazgos, vinculación explícita con NC y planes de acción, preparación de auditoría, informe exportable y consulta acotada.
- **Excluye:** asistente general del negocio, revisiones programadas, OCR (ver D1), auditoría de normas sin PDF (ver D3), cierre o modificación automática de registros y más de un proveedor de IA activo a la vez.

## Decisiones principales (tomadas)

| ID | Decisión | Motivo |
|---|---|---|
| A1 | Se reutilizan `NormativeStandard`, `NormativeClause`, `Document`, `AiFinding`, `NonConformity` y `ActionPlan`. Se agregan solo tablas `Auditor*` aditivas | Evitar duplicar la fuente normativa y aprovechar la deduplicación existente `NonConformity.aiFindingId` |
| A2 | Sin base vectorial ni framework de agentes. Los conectores son deterministas por requisito, con búsqueda acotada en Postgres | La evidencia es mayormente estructurada y el volumen por tenant es chico. Ver §5 de 02 |
| A3 | Ejecución en la cola BullMQ existente (`apps/api/src/jobs/queue.ts`), con una nueva cola `auditor-ia` | Hoy ya hay Redis y workers |
| A4 | Modelo vía `services/llm/factory.ts` detrás de un adaptador `AuditorLLM`, con un único proveedor configurable | El cambio de proveedor no toca la lógica funcional |
| A5 | El estado se separa en 4 ejes: trabajo, evidencia, dictamen IA y decisión humana | Es un requisito del negocio. Se elimina el % basado en presencia |
| A6 | Si la IA devuelve una salida inválida, el resultado queda en `CANNOT_EVALUATE`; nunca se usa un dictamen por defecto | Corrige el patrón observado en `compliance-evidences.ts` |
| A7 | El módulo convive con `/audit` ("Auditoría IA") en v1, sin migrarlo | Bajo riesgo. Ver D5 |

## Glosario mínimo

- **Requisito:** enunciado verificable derivado de una cláusula y aprobado por una persona.
- **Revisión:** ejecución sobre norma, versión, alcance y período.
- **Evaluación:** resultado por requisito dentro de una revisión. Es inmutable y se versiona.
- **Evidencia:** referencia a un registro o documento con su versión o fecha.
