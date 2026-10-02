// ── Etiquetas editables del Mapa General de Procesos ─────────────────────────
// Los textos del diagrama (bandas, conectores, cajas de extremo, externalizados,
// leyenda) se persisten por tenant en company_settings.mapaGeneralLabels y se
// editan desde el modal "Textos del mapa". Un valor vacío en el override vuelve
// al default definido acá.

export type MapLabels = Record<string, string>;

export const DEFAULT_LABELS = {
  // Encabezado de la vista
  title: 'Mapa general de procesos',
  subtitle: 'Operaciones independientes, procesos conectados',

  // Bandas (riel izquierdo de cada franja)
  bandStrategic: 'Estratégicos',
  bandStrategicDesc: 'Definen el rumbo, aseguran recursos y la mejora del sistema',
  bandOperational: 'Operativos',
  bandOperationalDesc: 'Transforman requisitos en ruedas conformes para el cliente',
  bandSupport: 'Soporte',
  bandSupportDesc: 'Proveen recursos, controles y servicios para el funcionamiento del sistema',

  // Conectores entre bandas (flechas bidireccionales)
  connStrategicDown: 'Objetivos, decisiones y recursos',
  connStrategicUp: 'Indicadores y resultados',
  connSupportUp: 'Recursos y controles',
  connSupportDown: 'Necesidades y resultados',

  // Lazo de retroalimentación de la cadena operativa
  loopTag: 'Desempeño, reclamos y cambios',

  // Cajas de extremo de la cadena operativa.
  // endInTitle/endOutTitle: usar "/" para partir en dos líneas (ej. "Cliente / Entradas").
  // endInItems/endOutItems: un ítem por línea; solo se muestran cuando ningún mapa
  // operativo define etiqueta de entrada/salida propia.
  endInTitle: 'Cliente / Entradas',
  endOutTitle: 'Cliente / Resultados',
  endInItems: 'Requisitos y CSR\nEspecificaciones\nProgramas de entrega',
  endOutItems: 'Productos conformes\nEntregas acordadas\nTrazabilidad',

  // Sección externalizados (franja Soporte)
  outsourcedTitle: 'Procesos externalizados',
  outsourcedHint: 'Identificar proveedor, proceso, controles e interfaces',

  // Leyenda al pie del diagrama
  legendLeft: 'Procesos e interacciones del sistema de gestión.',
  legendRight: 'Cada proceso se vincula a su ficha: responsable, entradas/salidas, riesgos, controles e indicadores.',

  // Varios
  sitePending: 'Sede pendiente de definir',
  enablerDefault: 'Proceso validado', // flecha habilitador → cadena cuando no hay interacción ni salida cargada
} as const;

export type LabelKey = keyof typeof DEFAULT_LABELS;

// Definición de campos para el editor (orden + agrupación del modal).
export const LABEL_FIELDS: { key: LabelKey; label: string; section: string; multiline?: boolean; hint?: string }[] = [
  { key: 'title', label: 'Título del mapa', section: 'Encabezado', hint: 'La norma (ISO 9001 / IATF 16949) se agrega automáticamente según la pestaña' },
  { key: 'subtitle', label: 'Subtítulo', section: 'Encabezado' },

  { key: 'bandStrategic', label: 'Nombre franja superior', section: 'Bandas' },
  { key: 'bandStrategicDesc', label: 'Descripción franja superior', section: 'Bandas', multiline: true },
  { key: 'bandOperational', label: 'Nombre franja central', section: 'Bandas' },
  { key: 'bandOperationalDesc', label: 'Descripción franja central', section: 'Bandas', multiline: true },
  { key: 'bandSupport', label: 'Nombre franja inferior', section: 'Bandas' },
  { key: 'bandSupportDesc', label: 'Descripción franja inferior', section: 'Bandas', multiline: true },

  { key: 'connStrategicDown', label: 'Franja superior → operativa (flecha que baja)', section: 'Conectores entre franjas' },
  { key: 'connStrategicUp', label: 'Operativa → franja superior (flecha que sube)', section: 'Conectores entre franjas' },
  { key: 'connSupportUp', label: 'Soporte → operativa (flecha que sube)', section: 'Conectores entre franjas' },
  { key: 'connSupportDown', label: 'Operativa → soporte (flecha que baja)', section: 'Conectores entre franjas' },
  { key: 'loopTag', label: 'Retroalimentación (lazos laterales y línea inferior)', section: 'Conectores entre franjas' },

  { key: 'endInTitle', label: 'Título caja de entrada (izquierda)', section: 'Cadena operativa', hint: 'Usá "/" para partir en dos líneas' },
  { key: 'endOutTitle', label: 'Título caja de salida (derecha)', section: 'Cadena operativa', hint: 'Usá "/" para partir en dos líneas' },
  { key: 'endInItems', label: 'Ítems caja de entrada', section: 'Cadena operativa', multiline: true, hint: 'Un ítem por línea. Solo se usan si ningún mapa define etiqueta de entrada' },
  { key: 'endOutItems', label: 'Ítems caja de salida', section: 'Cadena operativa', multiline: true, hint: 'Un ítem por línea. Solo se usan si ningún mapa define etiqueta de salida' },
  { key: 'enablerDefault', label: 'Etiqueta flecha habilitador → cadena', section: 'Cadena operativa', hint: 'Se usa cuando no hay interacción configurada ni salida cargada' },

  { key: 'outsourcedTitle', label: 'Título sección externalizados', section: 'Externalizados' },
  { key: 'outsourcedHint', label: 'Texto de la sección cuando está vacía', section: 'Externalizados', multiline: true },

  { key: 'legendLeft', label: 'Leyenda izquierda', section: 'Leyenda al pie', multiline: true },
  { key: 'legendRight', label: 'Leyenda derecha', section: 'Leyenda al pie', multiline: true },

  { key: 'sitePending', label: 'Texto "sin sede definida"', section: 'Varios' },
];

// Resuelve una etiqueta: override del tenant si tiene texto, si no el default.
export function resolveLabel(labels: MapLabels | undefined | null, key: LabelKey): string {
  const v = labels?.[key];
  return v && v.trim() ? v : DEFAULT_LABELS[key];
}
