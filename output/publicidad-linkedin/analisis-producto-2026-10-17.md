# Actualización de base comercial — 17/10/2026

Revisión estática del proyecto local e historial Git. No prueba funcional ni confirmación de despliegue.

## Posicionamiento
SGI360 conecta gestión, operación y resultados del negocio. Presentar a responsables de calidad, operaciones y dueños con problemas diferentes.

## Capacidades respaldadas
- Centro de Control Empresarial: campus/procesos, departamentos configurables, responsables, conexiones de entradas/salidas/información/recursos, indicadores y semáforos de módulos. Fuente: apps/api/src/routes/centro-empresa.ts y frontend centro-empresa.
- Centro de Control Flota: vista 3D de estados operativos, detalle de unidad, alertas, eventos de inspecciones, taller; modo real y demo separados. Actualización por consulta periódica de 30s. Fuentes: frontend flota-360/centro-control/page.tsx, _components/data.ts, Panels.tsx. Posiciones indicativas, NO GPS ni telemetría.
- Resultados del Negocio: ventas/facturas, gastos, cobros/pagos, flujo de caja, proyección, rentabilidad, balance gerencial estimado, centros de costo. Backend finanzas registrado en app.ts. Reúne datos de finanzas e ingresos/servicios de flota en rentabilidad. Asistente para explicar indicadores y preguntas libres. Fuente: routes/finanzas.ts y frontend resultados.
- Chile: importar RCV, sincronización SII con configuración/credenciales, consulta F29; conciliación de cartola con preview y deshacer. No atribuir estas integraciones a Argentina ni afirmar declaración fiscal automática.
- Packs normativos: commits recientes agregan plantillas ISO 9001/14001/45001/27001/22301/28000/9004 e IATF, cascada de cláusulas, mapa, objetivos y riesgos sugeridos. Verificar funcionalmente antes de campañas de detalle. No prometer certificación automática.
- Captación: nuevas páginas por norma, recursos, herramientas descargables, captura de leads y entrega por email (historial reciente).

## Desconexiones observadas
- centro-empresa.ts: DEFAULT_DEPARTMENTS administración usa moduleKey resultados y href /proyectos. case resultados agrega riesgos altos y acciones abiertas, no datos financieros de /finanzas. No anunciar consolidación financiera dentro de este centro hasta conectar y validar.
- centro-empresa.ts case calidad etiqueta ncVencidas como acciones vencidas; corregir denominación o fuente para no confundir indicadores.
- Balance es gerencial estimado y la UI indica que no reemplaza balance del contador.

## Ángulos futuros
1. ¿Qué área necesita atención hoy? Centro empresarial.
2. ¿Qué unidad está realmente disponible? Control de flota y restricciones.
3. Facturás, pero ¿cuándo cobrás? Cuentas por cobrar/caja.
4. ¿Qué servicio deja margen? Rentabilidad según datos y asignaciones registradas.
5. ¿Cómo llegás al cierre del mes? Proyecciones estimadas.
6. Un indicador que también podés entender: asistente de resultados.
7. Empezar el SGI desde una base: packs sugeridos, con adaptación por el equipo.

Este análisis no cambia por sí solo la prioridad guardada de la automatización (alternancia Flota/Core Tools).
