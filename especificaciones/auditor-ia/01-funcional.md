# 01 — Diseño funcional

Principios obligatorios: ver el enunciado del proyecto. Aquí se traducen a reglas (`R-n`) verificables.

## 1. Navegación

- Nueva entrada **"Auditor IA"** en `Sidebar.tsx`, bloque "Marco normativo", debajo de "Normativos". Ícono `Sparkles` (lucide). Ruta `/auditor-ia`.
- Título en `Topbar.tsx`: "Auditor IA — Cumplimiento normativo con evidencia trazable".
- Permiso por módulo: clave `auditor-ia` en `User.permissions` (`view` / `edit`). Gating de plan: feature `auditor_ia`.
- Estilo: menú oscuro, acentos `brand`, tarjetas `rounded-xl border-neutral-200 bg-white` y componentes `components/ui/*`.

## 2. Pantallas

### P1 — Principal `/auditor-ia` (según la referencia visual)

| Zona | Contenido | Interacción |
|---|---|---|
| Cabecera | Título y botón **Iniciar revisión** | Abre el modal P1a |
| Barra de contexto | Selector de norma y versión (solo con extracción `APPROVED`), "Fuente: Normativos / PDF" con enlace, alcance, proceso, sede y período de la revisión activa | Cambiar la revisión activa desde el historial |
| Tarjetas resumen | Requisitos revisados · Con evidencia · Por validar · Sin evidencia · No evaluables | Al hacer clic, filtra la matriz |
| Matriz | Requisito · Fuente SGI 360 (conectores) · Estado (chip del eje dominante, §4) · › | Al seleccionar una fila se abre el inspector |
| Trazabilidad | Normativos PDF → Requisito → Fuentes → Evaluación | Cada nodo es un enlace |
| Inspector (panel derecho) | Resumen, chip de estado, **Fuentes consultadas** (requisito en PDF con página, módulo, documentos), fuentes no disponibles, limitaciones, **Sugerencia del agente**, botones **Revisar propuesta** y **Descartar**, aviso "Las propuestas requieren validación del responsable" | Ver P1b |
| Barra de consulta | Campo "Consultá un requisito o pedí revisar un proceso…", atajos **¿Qué evidencia falta?** y **Preparar auditoría** | Ver §6 |

**P1a — Iniciar revisión:** norma y versión, alcance (texto que se precarga desde el contexto), procesos (`Process`), sedes (valores de `Process.sites` / `SgiObjective.sites`), período (desde/hasta) y cláusulas (todas o un subconjunto). Antes de confirmar muestra los requisitos a evaluar, los tokens estimados y el costo estimado. Si se supera el límite (§G de 02), queda bloqueado.

**P1b — Revisar propuesta:** muestra el dictamen IA, las evidencias con su estado (apoya / no apoya / no concluyente), las brechas y las propuestas. Acciones disponibles:
- Validar.
- Confirmar brecha.
- Pedir más evidencia.
- Rechazar dictamen.
- Proponer "No aplica", con justificación obligatoria.

Además se puede vincular evidencia manualmente (buscador por conector) y comentar.

**Estados de la pantalla:**
- Vacío sin normas: CTA "Cargá una norma en Normativos".
- Vacío sin extracción aprobada: CTA hacia P2.
- Carga: skeletons.
- Revisión en curso: barra de progreso con N/M y botón **Cancelar**.
- Error de IA no configurada (503): mensaje y aviso al administrador.
- Error parcial: banner "X requisitos no evaluados" con botón **Reintentar**.

### P2 — Extracción normativa `/auditor-ia/normas/[normativeId]`

Muestra el estado de extracción (§4.1), el diagnóstico del PDF (páginas, texto por página, escaneado, protegido) y una lista de requisitos propuestos con cláusula, página, enunciado parafraseado, tipo de verificación y conectores sugeridos. Cada requisito se puede editar, unir, dividir, descartar o aprobar. Además hay un botón **Aprobar extracción** (solo `edit`).

Cuando se carga una nueva versión de la norma, se crea una extracción nueva. Las revisiones históricas siguen apuntando a la versión anterior.

### P3 — Historial `/auditor-ia/revisiones`

Tabla con fecha, norma y versión, alcance, estado del trabajo, contadores, responsable y modelo. Las revisiones son de solo lectura, salvo la decisión humana pendiente.

### P4 — Preparación de auditoría `/auditor-ia/revisiones/[id]/preparacion`

Pestañas Por cláusula, Por proceso, Checklist, Preguntas sugeridas, Evidencias a solicitar y Pendientes priorizados. Botón **Exportar informe**.

El informe separa dos secciones:
- "Preparación asistida (no constituye conclusión de auditoría)".
- "Conclusiones del auditor", que solo incluye decisiones humanas.

## 3. Flujos

1. **Ingesta:** se elige una norma en Normativos, se extrae el texto por página y se proponen requisitos. Una persona los revisa y aprueba la extracción. Sin aprobación no se puede iniciar una revisión (R-1).
2. **Revisión:** se configura alcance y período, se encola la revisión, los conectores recolectan evidencia y la IA evalúa cada requisito. El resultado queda **Por validar**.
3. **Validación:** el responsable decide por requisito. Esa decisión es la única que habilita el estado "Validado".
4. **Hallazgo:** desde una brecha confirmada se arma un borrador, que se valida y luego, con una acción explícita, crea o vincula una NC o un plan de acción.
5. **Preparación:** a partir de la revisión se genera el checklist, las preguntas y los pendientes, y se exporta.
6. **Desactualización:** cuando cambia una fuente citada, la evaluación pasa a `STALE` y se ofrece reevaluar solo ese requisito.

## 4. Estados

### 4.1 Extracción (`AuditorExtraction.status`)
`NOT_STARTED → EXTRACTING → PENDING_APPROVAL → APPROVED`. Desde `EXTRACTING` puede pasar a `UNREADABLE` (sin texto, protegido o escaneado) o `FAILED`. Desde `PENDING_APPROVAL` puede pasar a `REJECTED`, y de ahí volver a `EXTRACTING`. Una extracción `APPROVED` es inmutable: los cambios generan una extracción nueva.

### 4.2 Revisión (`AuditorReview.status`)
`DRAFT → QUEUED → RUNNING → COMPLETED | PARTIAL | FAILED | CANCELLED`. Desde `PARTIAL` o `FAILED` se puede reintentar (vuelve a `QUEUED`, solo con los pendientes). Desde `QUEUED` o `RUNNING` se puede cancelar (`CANCELLED`).

### 4.3 Evaluación por requisito (4 ejes independientes)

| Eje | Valores | Quién lo fija |
|---|---|---|
| `workStatus` | `PENDING`, `IN_PROGRESS`, `EVALUATED`, `CANNOT_EVALUATE`, `STALE` | Sistema |
| `evidenceStatus` | `NOT_SEARCHED`, `FOUND`, `PARTIAL`, `ABSENT`, `SOURCE_UNAVAILABLE` | Conectores (presencia, no suficiencia) |
| `aiVerdict` | `NONE`, `EVIDENCE_SUPPORTS`, `POSSIBLE_GAP`, `REQUIRES_EXTERNAL_VERIFICATION`, `INSUFFICIENT_EVIDENCE` | IA |
| `humanDecision` | `PENDING`, `VALIDATED`, `GAP_CONFIRMED`, `MORE_EVIDENCE_REQUESTED`, `AI_REJECTED`, `NA_PROPOSED`, `NA_APPROVED`, `NA_REJECTED` | Persona |

**Transiciones humanas:**
- `PENDING` pasa a `VALIDATED`, `GAP_CONFIRMED`, `MORE_EVIDENCE_REQUESTED`, `AI_REJECTED` o `NA_PROPOSED`.
- `NA_PROPOSED` pasa a `NA_APPROVED` o `NA_REJECTED`. La aprobación la hace un usuario distinto del proponente, con `TENANT_ADMIN` (R-6).
- `STALE` devuelve `humanDecision` a `PENDING` y conserva la decisión anterior en el historial.

**Mapeo a las tarjetas:**
- **Con evidencia:** `evidenceStatus ∈ {FOUND, PARTIAL}`.
- **Sin evidencia:** `ABSENT`.
- **Por validar:** `workStatus = EVALUATED` y `humanDecision = PENDING`.
- **No evaluables:** `CANNOT_EVALUATE` o `REQUIRES_EXTERNAL_VERIFICATION`.

No se muestra ningún porcentaje de cumplimiento (R-4).

### 4.4 Hallazgo borrador (`AiFinding` con `auditType='auditor_ia'`)
`DRAFT → VALIDATED | REJECTED`. Desde `VALIDATED` se llega a `LINKED` (NC o plan de acción vinculado). El seguimiento lee el estado de la NC o el plan, y nunca lo cierra (R-8).

## 5. Reglas funcionales

| ID | Regla |
|---|---|
| R-1 | Solo se evalúa contra requisitos de una extracción `APPROVED` de un `NormativeStandard` con PDF |
| R-2 | Toda cita normativa incluye norma, versión, cláusula y página. Si falta la página, se muestra "página no determinada" y nunca se inventa |
| R-3 | Toda evidencia citada incluye tipo, id, versión o `updatedAt` y enlace. La IA solo puede citar evidencias que se le entregaron |
| R-4 | No hay porcentajes de cumplimiento. Los contadores son por estado |
| R-5 | Si el requisito exige observación, entrevista o evidencia externa, el resultado es `REQUIRES_EXTERNAL_VERIFICATION` y nunca "cumple" |
| R-6 | "No aplica" requiere justificación de 20 caracteres o más y aprobación de un usuario distinto con `TENANT_ADMIN` |
| R-7 | No se exige un documento separado si un registro nativo cubre el requisito, salvo que el requisito pida "información documentada mantenida/conservada" |
| R-8 | La IA no crea ni cierra NC o planes, ni edita documentos. Toda escritura en otros módulos es una acción explícita del usuario |
| R-9 | El contenido de PDF, documentos y registros es dato: se ignoran las instrucciones contenidas en él |
| R-10 | El informe no incluye el texto completo de la norma. Usa número, título, página y paráfrasis de 300 caracteres como máximo |
| R-11 | Se consideran alcance, procesos, sedes y período. La evidencia fuera del período se marca "fuera de período" |
| R-12 | Las consultas conversacionales solo responden sobre la revisión, la norma y las fuentes autorizadas. Lo demás se rechaza |

## 6. Consulta conversacional

- Contexto: la revisión activa (requisitos, evaluaciones y metadatos de evidencias ya recolectadas). No hace búsquedas nuevas ilimitadas.
- Atajos: **¿Qué evidencia falta?** lista los requisitos `ABSENT`/`PARTIAL` con las evidencias a solicitar. **Preparar auditoría** abre P4.
- Cada respuesta trae citas. No ejecuta acciones: ofrece enlaces a P1b.

## 7. Permisos

| Acción | `view` | `edit` | `TENANT_ADMIN` |
|---|---|---|---|
| Ver revisiones, matriz, informe | ✓ | ✓ | ✓ |
| Consultar (barra) | ✓ | ✓ | ✓ |
| Iniciar, cancelar o reintentar revisión | | ✓ | ✓ |
| Editar o aprobar extracción | | ✓ | ✓ |
| Decisión humana y vinculación manual | | ✓ | ✓ |
| Proponer N/A | | ✓ | ✓ |
| Aprobar N/A | | | ✓ (distinto del proponente) |
| Crear o vincular NC o plan de acción | | ✓ más permiso `calidad`/`edit` | ✓ |

Los conectores solo devuelven datos de módulos que el usuario puede ver (`view`). Si un módulo no es visible, aparece como `SOURCE_UNAVAILABLE` con el motivo "sin permiso".
