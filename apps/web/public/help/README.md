# Guía para Capturar Screenshots del Centro de Ayuda

## Instrucciones Rápidas

1. Accedé al sistema en testing: **http://46.62.253.81:4000**
2. Navegá a cada módulo listado abajo
3. Capturá la pantalla (Cmd+Shift+4 en Mac, o herramienta de captura)
4. Guardá la imagen con el nombre indicado en esta carpeta (`/public/help/`)
5. Rebuild y redeploy

---

## Lista Consolidada de Screenshots Requeridos

### Dashboard / Inicio
| Archivo | Qué capturar | Ruta en el sistema |
|---------|-------------|-------------------|
| `inicio-1.png` | Dashboard principal con métricas visibles | `/dashboard` |
| `inicio-2.png` | Selector de período abierto | `/dashboard` (clic en selector) |
| `inicio-3.png` | Panel de alertas con 2+ alertas | `/dashboard` (scroll abajo) |

### Panel General
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `panel-1.png` | Panel General con gráficos de KPIs | `/panel` |
| `panel-2.png` | Tabs de filtrado por área (Calidad, SST, Ambiente, RRHH) | `/panel` |
| `panel-3.png` | Botón Exportar PDF y diálogo | `/panel` |

### Documentos
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `documentos-1.png` | Listado de documentos con estados | `/documents` |
| `documentos-2.png` | Formulario nuevo documento completo | `/documents` → Nuevo documento |
| `documentos-3.png` | Sección vinculación cláusulas en detalle | `/documents/[id]` |
| `documentos-4.png` | Historial de versiones de un documento | `/documents/[id]` |

### Normativos
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `normativos-1.png` | Biblioteca de normas con estados | `/normativos` |
| `normativos-2.png` | Árbol de cláusulas de una norma ISO | `/normativos/[id]` |
| `normativos-3.png` | Detalle de cláusula con 2+ documentos vinculados | `/normativos/[id]` |

### Auditoría IA
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `audit-ia-1.png` | Pantalla de análisis con dropdowns | `/audit/analyze` |
| `audit-ia-2.png` | Progreso durante análisis activo | `/audit/analyze` (durante ejecución) |
| `audit-ia-3.png` | Hallazgos completados con 2+ visibles | `/audit` |
| `audit-ia-4.png` | Detalle de hallazgo con evidencia | `/audit` → clic en hallazgo |
| `audit-ia-5.png` | Chat auditor con 2+ mensajes | `/audit/chat` |

### Auditorías ISO
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `auditorias-iso-1.png` | Programa anual de auditorías | `/auditorias` |
| `auditorias-iso-2.png` | Formulario nueva auditoría | `/auditorias/nueva` |
| `auditorias-iso-3.png` | Checklist en ejecución con 5+ ítems | `/auditorias/[id]/execute` |
| `auditorias-iso-4.png` | Formulario registro de hallazgo | `/auditorias/[id]/execute` |
| `auditorias-iso-5.png` | Vista previa informe final | `/auditorias/[id]` |

### No Conformidades
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `no-conformidades-1.png` | Listado de NC con estados | `/no-conformidades` |
| `no-conformidades-2.png` | Formulario nueva NC | `/no-conformidades` → Nueva |
| `no-conformidades-3.png` | Análisis causa raíz (5 Porqués/Ishikawa) | `/no-conformidades/[id]` |
| `no-conformidades-4.png` | Plan de acción | `/no-conformidades/[id]` |
| `no-conformidades-5.png` | Cierre de NC | `/no-conformidades/[id]` |

### Riesgos
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `riesgos-1.png` | Matriz de riesgos | `/riesgos` |
| `riesgos-2.png` | Formulario nuevo riesgo | `/riesgos` → Nuevo |
| `riesgos-3.png` | Evaluación probabilidad × impacto | `/riesgos/[id]` |

### Indicadores
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `indicadores-1.png` | Biblioteca de indicadores | `/indicadores` |
| `indicadores-2.png` | Formulario nuevo indicador con fórmula | `/indicadores` → Nuevo |
| `indicadores-3.png` | Gráfico de tendencia | `/indicadores/[id]` |

### Capacitaciones
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `capacitaciones-1.png` | Plan anual de capacitaciones | `/capacitaciones` |
| `capacitaciones-2.png` | Formulario nueva capacitación | `/capacitaciones` → Nueva |
| `capacitaciones-3.png` | Registro de asistencia | `/capacitaciones/[id]` |

### RRHH
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `rrhh-1.png` | Directorio de empleados | `/rrhh` |

### Clientes
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `clientes-1.png` | Listado de clientes | `/clientes` |

### Licencias
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `licencias-1.png` | Licencias y vencimientos | `/licencias` |

### Notificaciones
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `notificaciones-1.png` | Bandeja de notificaciones | `/notificaciones` |

### Configuración
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `configuracion-1.png` | Panel de configuración | `/configuracion` |

### Integraciones
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `integraciones-1.png` | Listado de integraciones | `/integraciones` |

### Mantenimiento
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `mantenimiento-1.png` | Órdenes de mantenimiento | `/mantenimiento` |

### Simulacros
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `simulacros-1.png` | Listado de simulacros | `/simulacros` |

### Activos
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `activos-1.png` | Inventario de activos | `/activos` |

### Incidentes
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `incidentes-1.png` | Listado de incidentes | `/incidentes` |

### Calidad
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `calidad-1.png` | Procesos de calidad | `/calidad` |

### Ambientales
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `ambientales-1.png` | Aspectos ambientales | `/ambientales` |

### Contexto
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `contexto-1.png` | Análisis FODA | `/contexto` |

### Partes Interesadas
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `partes-interesadas-1.png` | Listado de partes interesadas | `/partes-interesadas` |

### Reportes
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `reportes-1.png` | Listado de reportes | `/reportes` |

### Planes
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `planes-1.png` | Planes de acción | `/planes` |

### Objetivos
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `objetivos-1.png` | Listado de objetivos | `/objetivos` |

### Empresa
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `empresa-1.png` | Datos de la empresa | `/configuracion/empresa` |

### Cumplimiento
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `cumplimiento-1.png` | Evaluaciones de cumplimiento | `/cumplimiento` |

### Gestión de Cambios
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `gestion-cambios-1.png` | Solicitudes de cambio | `/gestion-cambios` |

### Encuestas
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `encuestas-1.png` | Listado de encuestas | `/encuestas` |

### Calendario
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `calendario-1.png` | Vista mensual del calendario | `/calendario` |

### Infraestructura
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `infraestructura-1.png` | Listado de infraestructura | `/infraestructura` |

### IPERC
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `iperc-1.png` | Evaluaciones IPERC | `/iperc` |

### Legales
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `legales-1.png` | Requisitos legales | `/legales` |

### Calibraciones
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `calibraciones-1.png` | Equipos de medición | `/calibraciones` |

### Acciones
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `acciones-1.png` | Listado de acciones | `/acciones` |

### Auditoría (módulo simple)
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `auditoria-1.png` | Listado de auditorías | `/auditoria` |

### Audit360
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `audit360-1.png` | Auditoría 360° | `/audit360` |

### Contexto SGI
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `contexto-sgi-1.png` | Alcance del SGI | `/contexto-sgi` |

### Dashboard Simple
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `dashboard-simple-1.png` | Vista simplificada | `/dashboard-simple` |

### Proveedores
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `proveedores-1.png` | Listado de proveedores | `/proveedores` |

### Revisión por la Dirección
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `revision-direccion-1.png` | Actas de revisión | `/revision-direccion` |

### Seguridad 360
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `seguridad360-1.png` | Riesgos SST | `/seguridad360` |

### PROJECT360
| Archivo | Qué capturar | Ruta |
|---------|-------------|------|
| `project360-1.png` | Listado de proyectos | `/project360` |
| `project360-2.png` | Vista Kanban con tareas | `/project360` (vista Kanban) |
| `project360-3.png` | Detalle de proyecto | `/project360/[id]` |

---

## Comando para redeploy después de agregar screenshots

```bash
ssh root@46.62.253.81 "cd /root/friopro && docker compose -p friopro-testing -f docker-compose.testing.yml build web && docker compose -p friopro-testing -f docker-compose.testing.yml up -d web"
```

## Nota técnica

Las imágenes deben guardarse en esta carpeta (`/public/help/`) con los nombres exactos listados arriba. El componente del Centro de Ayuda las referencia automáticamente cuando detecta que el archivo existe. Mientras no existan, muestra un placeholder informativo con instrucciones.
