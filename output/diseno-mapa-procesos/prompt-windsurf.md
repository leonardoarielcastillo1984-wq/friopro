Rediseñá el mapa de procesos de SGI360 en Contexto del SGI → Mapa de Procesos. Usá la imagen referencia-mapa-iso9001.png adjunta como guía visual, conservando el estilo actual del sistema. Implementá los cambios, no te limites a proponerlos.

OBJETIVO
Que se entienda de inmediato cuáles son las operaciones principales, qué ocurre dentro de cada una y qué procesos les dan soporte. Actualmente se mezclan áreas, operaciones y etapas en una cadena horizontal; Compras aparece repetido y Tráfico figura como soporte.

1. ESTRUCTURA
- Franja superior compacta de procesos estratégicos, con Dirección y sus vínculos: objetivos, decisiones y recursos hacia las operaciones; indicadores y resultados de regreso.
- Centro: tres bloques grandes, de igual jerarquía, para CKD, Paragolpes y Tráfico. Son operaciones independientes en paralelo: no dibujar una secuencia CKD → Paragolpes → Tráfico.
- Cada operación muestra sus propias entradas, etapas/subprocesos y salidas. Planificación CKD y Armado de Cajones deben quedar dentro de CKD si la configuración real confirma esa pertenencia.
- Botón Agregar operación; estructura dinámica, sin limitar ni hardcodear el sistema a estas tres operaciones.
- Abajo: soporte compartido. Compras debe figurar como un único proceso de soporte para esta configuración. Mantener Contrataciones, Administración, RR. HH., Mantenimiento, Sistemas, Gestión Documental y Gestión de Calidad cuando correspondan a procesos reales distintos.
- Revisar Comercial y todos los procesos existentes: asignarles un lugar según su función y relaciones reales; no ocultar ni eliminar los que no aparecen en la referencia.

2. INTERACCIONES VISIBLES
- Al seleccionar CKD, Paragolpes o Tráfico, resaltar sus soportes vinculados y mostrar una banda “Soporte a [operación]” con el nombre del soporte y su aporte concreto.
- Al seleccionar un soporte, resaltar todas las operaciones a las que aporta.
- Las etiquetas como “Compras · Insumos”, “Mantenimiento · Equipos” o “RR. HH. · Competencias” son ejemplos visuales, no relaciones a crear automáticamente.
- Registrar/editar origen, destino, aporte o entrada/salida y descripción de cada relación usando el modelo existente; ampliarlo solo si resulta necesario.
- Evitar una maraña de flechas. Vista general simple; vínculos específicos al seleccionar o activar Interacciones.
- Mostrar claramente cuando una operación no tiene vínculos configurados; nunca inventar asociaciones.

3. DATOS Y DUPLICADOS
- Investigar por qué Compras aparece varias veces: render duplicado, registros distintos o subprocesos mal clasificados.
- Un mismo ID de proceso debe renderizarse una sola vez como tarjeta principal. Las referencias en la banda de relaciones no son procesos nuevos.
- No fusionar ni borrar registros solo porque coincidan sus nombres. Preservar IDs, responsables, documentos, riesgos, indicadores e interacciones. Si hay duplicados reales, presentar su comparación y una propuesta de consolidación sin pérdida de datos.
- La clasificación solicitada corresponde a esta organización; mantener categorías configurables para otras empresas.
- No inventar las etapas ni las entradas/salidas a partir de la imagen: usar las registradas. Si faltan, ofrecer “Configurar etapas”, “Definir entradas” o “Definir salidas”.

4. DISEÑO
- Conservar tipografía, iconos, fondo claro, bordes finos, radios y controles existentes; azul para estratégicos, verde para operaciones y gris para soporte.
- CKD, Paragolpes y Tráfico deben leerse sin desplazamiento horizontal en escritorio. Usar grid adaptable: tres columnas en pantallas amplias, dos o una en tamaños menores.
- Soportes en tarjetas compactas con nombre y una línea de propósito, distribuidas en varias filas si hace falta.
- Quitar párrafos extensos del mapa general. Mostrar el detalle en el panel lateral al seleccionar: responsable, alcance, sede, entradas, salidas, etapas, documentos, riesgos, indicadores e interacciones disponibles.
- Reducir espacio vacío en Dirección. Jerarquía visual clara y suficiente contraste; selección también reconocible por borde/icono, no solo por color.
- Mantener filtros por norma y sede, buscador, edición de textos, permisos y procesos externalizados. Un vínculo fuera del filtro no debe aparentar haber sido eliminado.
- Las cantidades de las pestañas deben calcularse con datos reales, no copiar las de la imagen.

5. VALIDACIÓN Y ENTREGA
- Verificar con los datos actuales la clasificación y pertenencia de operaciones y subprocesos.
- Confirmar que Compras no se repite como nodo principal, Tráfico aparece como operación y cada operación resalta solamente sus soportes configurados.
- Validar agregar una cuarta operación, estados vacíos, búsqueda, filtros ISO 9001/IATF/Completo, sede, permisos y comportamiento responsive.
- No alterar datos productivos ni ejecutar migraciones destructivas para lograr el diseño. Preservar funcionalidades existentes.
- Entregar implementación, capturas del resultado, cambios realizados, validaciones y cualquier clasificación pendiente de confirmar.

La imagen es una referencia de distribución e interacción. Sus etapas, aportes, entradas y resultados son ilustrativos y deben reemplazarse por los datos reales del sistema.
