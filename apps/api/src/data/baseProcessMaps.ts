// ──────────────────────────────────────────────────────────────
// Plantillas base de Mapa de Procesos (formato .sgi360.json)
// Aditivo y desacoplado: no altera tablas ni migraciones existentes.
// Este es el mismo formato que produce el export y que consume el import.
// ──────────────────────────────────────────────────────────────

export const SGI360_TEMPLATE_TYPE = 'process-map-template';
export const SGI360_TEMPLATE_VERSION = 1;

export type TemplateActivity = { name: string; description?: string; responsible?: string };

export type TemplateProcess = {
  ref: string;                 // referencia local estable (para parent e interacciones)
  parentRef?: string | null;   // ref del macroproceso padre (null = macroproceso)
  layer: 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
  name: string;
  code?: string | null;
  status?: 'active' | 'inactive';
  description?: string;
  owner?: string;
  inputs?: string;
  outputs?: string;
  sites?: string[];
  order?: number;
  objective?: string;
  observations?: string;
  clientsInternalRefs?: string[];
  suppliersInternalRefs?: string[];
  receivesFromRefs?: string[];
  deliversToRefs?: string[];
  activities?: TemplateActivity[];
  documents?: string[];        // nombres de documentos asociados
  risks?: string[];            // títulos de riesgos asociados
  indicators?: string[];       // nombres de indicadores asociados
};

export type SgiProcessMapTemplate = {
  sgi360: { type: string; version: number; exportedAt?: string; app: string };
  map: { name: string; description?: string; scope?: string; inputLabel?: string; outputLabel?: string };
  processes: TemplateProcess[];
};

function wrap(map: SgiProcessMapTemplate['map'], processes: TemplateProcess[]): SgiProcessMapTemplate {
  return {
    sgi360: { type: SGI360_TEMPLATE_TYPE, version: SGI360_TEMPLATE_VERSION, app: 'SGI360' },
    map,
    processes: processes.map((p, i) => ({ order: i, status: 'active', ...p })),
  };
}

// ── Empresa Comercial ──────────────────────────────────────────
const COMERCIAL = wrap(
  { name: 'Empresa Comercial', description: 'Mapa de procesos para una empresa comercial / retail.', scope: 'Comercialización de productos y atención al cliente.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Dirección y Planeamiento', objective: 'Definir la estrategia comercial y objetivos de la organización.', inputs: 'Análisis de mercado, resultados', outputs: 'Objetivos, presupuesto', indicators: ['Cumplimiento de objetivos'] },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Gestión Comercial y Marketing', objective: 'Planificar acciones de marketing y ventas.', inputs: 'Estrategia', outputs: 'Plan comercial' },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'Compras y Abastecimiento', objective: 'Adquirir productos para la venta.', inputs: 'Necesidades de stock', outputs: 'Mercadería recibida', activities: [{ name: 'Selección de proveedores' }, { name: 'Emisión de orden de compra' }], risks: ['Quiebre de stock'], indicators: ['Nivel de stock'] },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Ventas y Atención al Cliente', objective: 'Comercializar productos y atender clientes.', inputs: 'Pedido del cliente', outputs: 'Producto entregado, factura', receivesFromRefs: ['o1'], activities: [{ name: 'Toma de pedido' }, { name: 'Facturación' }], indicators: ['Satisfacción del cliente', 'Ventas mensuales'] },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Logística y Entregas', objective: 'Almacenar y distribuir la mercadería.', inputs: 'Producto facturado', outputs: 'Producto entregado', receivesFromRefs: ['o2'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Recursos Humanos', objective: 'Gestionar el personal y su desarrollo.', documents: ['Manual de Funciones'] },
    { ref: 's2', layer: 'SUPPORT', name: 'Administración y Finanzas', objective: 'Gestionar los recursos económicos.', indicators: ['Rentabilidad'] },
    { ref: 's3', layer: 'SUPPORT', name: 'Sistemas y Tecnología', objective: 'Soporte tecnológico e informático.' },
  ],
);

// ── Empresa Industrial ─────────────────────────────────────────
const INDUSTRIAL = wrap(
  { name: 'Empresa Industrial', description: 'Mapa de procesos para una empresa de manufactura.', scope: 'Producción y transformación de bienes.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Planeamiento Estratégico', objective: 'Definir la estrategia y objetivos industriales.', outputs: 'Objetivos, presupuesto' },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Gestión de la Calidad', objective: 'Asegurar la conformidad del producto y la mejora continua.', documents: ['Manual de Calidad'], indicators: ['No conformidades'] },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'Compras y Abastecimiento', objective: 'Abastecer materias primas e insumos.', outputs: 'Materia prima', risks: ['Incumplimiento de proveedores'] },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Producción', objective: 'Transformar materias primas en producto terminado.', inputs: 'Materia prima, orden de producción', outputs: 'Producto terminado', receivesFromRefs: ['o1'], activities: [{ name: 'Planificación de producción' }, { name: 'Fabricación' }, { name: 'Control de proceso' }], indicators: ['Eficiencia (OEE)', 'Scrap'] },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Control de Calidad', objective: 'Inspeccionar y liberar producto.', inputs: 'Producto terminado', outputs: 'Producto liberado', receivesFromRefs: ['o2'], risks: ['Producto no conforme'] },
    { ref: 'o4', layer: 'OPERATIONAL', name: 'Logística y Despacho', objective: 'Almacenar y despachar producto terminado.', receivesFromRefs: ['o3'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Mantenimiento', objective: 'Asegurar la disponibilidad de equipos.', indicators: ['Disponibilidad de equipos'] },
    { ref: 's2', layer: 'SUPPORT', name: 'Recursos Humanos', objective: 'Gestionar el personal y su competencia.' },
    { ref: 's3', layer: 'SUPPORT', name: 'Administración y Finanzas', objective: 'Gestionar recursos económicos.' },
  ],
);

// ── Empresa de Servicios ───────────────────────────────────────
const SERVICIOS = wrap(
  { name: 'Empresa de Servicios', description: 'Mapa de procesos para una empresa de servicios profesionales.', scope: 'Prestación de servicios a clientes.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Dirección Estratégica', objective: 'Definir la estrategia y objetivos del servicio.' },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Gestión Comercial', objective: 'Captar y fidelizar clientes.', outputs: 'Contrato de servicio' },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'Diseño del Servicio', objective: 'Diseñar y planificar el servicio a prestar.', inputs: 'Requisitos del cliente', outputs: 'Plan de servicio' },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Prestación del Servicio', objective: 'Ejecutar el servicio comprometido.', inputs: 'Plan de servicio', outputs: 'Servicio prestado', receivesFromRefs: ['o1'], activities: [{ name: 'Ejecución' }, { name: 'Seguimiento' }], indicators: ['Cumplimiento de SLA', 'Satisfacción del cliente'] },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Soporte y Postventa', objective: 'Atender consultas y reclamos.', receivesFromRefs: ['o2'], risks: ['Reclamos de clientes'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Recursos Humanos', objective: 'Gestionar el talento y su competencia.' },
    { ref: 's2', layer: 'SUPPORT', name: 'Administración y Finanzas', objective: 'Gestionar recursos económicos.' },
    { ref: 's3', layer: 'SUPPORT', name: 'Tecnología de la Información', objective: 'Proveer infraestructura y sistemas.' },
  ],
);

// ── Logística y Transporte ─────────────────────────────────────
const LOGISTICA = wrap(
  { name: 'Logística y Transporte', description: 'Mapa de procesos para operador logístico / de transporte.', scope: 'Almacenamiento, distribución y transporte de mercadería.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Planeamiento y Gestión', objective: 'Definir estrategia operativa y comercial.' },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Gestión Comercial', objective: 'Captar clientes y contratos de transporte.' },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'Recepción y Almacenamiento', objective: 'Recibir y almacenar mercadería.', inputs: 'Mercadería del cliente', outputs: 'Mercadería almacenada', indicators: ['Exactitud de inventario'] },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Planificación de Rutas', objective: 'Optimizar rutas y cargas.', inputs: 'Pedidos de despacho', outputs: 'Plan de ruta', receivesFromRefs: ['o1'] },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Transporte y Distribución', objective: 'Trasladar y entregar la mercadería.', inputs: 'Plan de ruta', outputs: 'Entrega realizada', receivesFromRefs: ['o2'], activities: [{ name: 'Carga' }, { name: 'Transporte' }, { name: 'Entrega y POD' }], risks: ['Demoras en entrega', 'Siniestros de tránsito'], indicators: ['Entregas a tiempo (OTIF)'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Mantenimiento de Flota', objective: 'Asegurar disponibilidad y seguridad de vehículos.', indicators: ['Disponibilidad de flota'] },
    { ref: 's2', layer: 'SUPPORT', name: 'Recursos Humanos', objective: 'Gestionar conductores y personal.' },
    { ref: 's3', layer: 'SUPPORT', name: 'Administración y Finanzas', objective: 'Gestionar recursos económicos.' },
  ],
);

// ── ISO 9001 (Sistema de Gestión de Calidad) ───────────────────
const ISO9001 = wrap(
  { name: 'ISO 9001 - Gestión de Calidad', description: 'Mapa de procesos alineado a ISO 9001:2015.', scope: 'Sistema de Gestión de la Calidad.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Liderazgo y Planificación', objective: 'Liderazgo, política y objetivos de calidad (Cap. 5 y 6).', documents: ['Política de Calidad'], indicators: ['Cumplimiento de objetivos de calidad'] },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Revisión por la Dirección', objective: 'Evaluar el desempeño del SGC (Cap. 9.3).' },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'Relación con el Cliente', objective: 'Determinar y revisar requisitos del cliente (Cap. 8.2).', inputs: 'Requisitos del cliente', outputs: 'Pedido confirmado' },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Diseño y Desarrollo', objective: 'Diseñar productos y servicios (Cap. 8.3).' },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Producción y Prestación del Servicio', objective: 'Ejecutar bajo condiciones controladas (Cap. 8.5).', receivesFromRefs: ['o1'], indicators: ['Producto conforme'] },
    { ref: 'o4', layer: 'OPERATIONAL', name: 'Compras / Proveedores Externos', objective: 'Controlar productos y servicios externos (Cap. 8.4).', risks: ['Proveedor no conforme'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Gestión de Recursos Humanos', objective: 'Competencia, formación y toma de conciencia (Cap. 7.2/7.3).' },
    { ref: 's2', layer: 'SUPPORT', name: 'Control de Información Documentada', objective: 'Controlar documentos y registros (Cap. 7.5).', documents: ['Procedimiento de Control de Documentos'] },
    { ref: 's3', layer: 'SUPPORT', name: 'Auditorías Internas y Mejora', objective: 'Auditoría interna, NC y mejora continua (Cap. 9.2/10).', indicators: ['No conformidades', 'Acciones cerradas'] },
    { ref: 's4', layer: 'SUPPORT', name: 'Infraestructura y Ambiente', objective: 'Proveer infraestructura y ambiente adecuados (Cap. 7.1).' },
  ],
);

// ── IATF 16949 (Automotriz) ─────────────────────────────────────
const IATF16949 = wrap(
  { name: 'IATF 16949 - Automotriz', description: 'Mapa de procesos alineado a IATF 16949:2016 (sector automotriz).', scope: 'SGC específico de la industria automotriz.' },
  [
    { ref: 'e1', layer: 'STRATEGIC', name: 'Liderazgo y Estrategia', objective: 'Política, objetivos y planificación del SGC automotriz.', documents: ['Política de Calidad'] },
    { ref: 'e2', layer: 'STRATEGIC', name: 'Gestión de Riesgos y Planes de Contingencia', objective: 'Gestionar riesgos y continuidad (IATF 6.1.2).', risks: ['Interrupción de suministro'] },
    { ref: 'o1', layer: 'OPERATIONAL', name: 'APQP / Planificación Avanzada de la Calidad', objective: 'Planificar la calidad del producto y proceso.', outputs: 'Plan de control', activities: [{ name: 'Diseño del proceso' }, { name: 'AMFE / FMEA' }], documents: ['Plan de Control', 'PFMEA'] },
    { ref: 'o2', layer: 'OPERATIONAL', name: 'Producción', objective: 'Fabricar bajo condiciones controladas.', inputs: 'Plan de control, materia prima', outputs: 'Producto terminado', receivesFromRefs: ['o1'], indicators: ['PPM', 'OEE'] },
    { ref: 'o3', layer: 'OPERATIONAL', name: 'Control de Calidad y Laboratorio', objective: 'Inspección, ensayos y liberación (SPC/MSA).', receivesFromRefs: ['o2'], risks: ['Producto no conforme'], indicators: ['Cpk'] },
    { ref: 'o4', layer: 'OPERATIONAL', name: 'Gestión de Proveedores', objective: 'Desarrollo y control de proveedores (IATF 8.4).', risks: ['Proveedor no calificado'] },
    { ref: 'o5', layer: 'OPERATIONAL', name: 'Logística y PPAP', objective: 'Aprobación de partes y entregas al cliente (PPAP).', receivesFromRefs: ['o3'], indicators: ['Entregas a tiempo'] },
    { ref: 's1', layer: 'SUPPORT', name: 'Mantenimiento (TPM)', objective: 'Mantenimiento productivo total de equipos.', indicators: ['Disponibilidad de equipos'] },
    { ref: 's2', layer: 'SUPPORT', name: 'Competencia y Formación', objective: 'Gestión de competencia del personal (IATF 7.2).' },
    { ref: 's3', layer: 'SUPPORT', name: 'Control de Documentos y Registros', objective: 'Información documentada del SGC (IATF 7.5).' },
    { ref: 's4', layer: 'SUPPORT', name: 'Auditorías y Mejora Continua', objective: 'Auditorías de proceso/producto y mejora (IATF 9.2/10).', indicators: ['No conformidades'] },
  ],
);

export type BaseTemplateMeta = { key: string; name: string; description: string; category: 'INDUSTRIA' | 'NORMA'; processCount: number };

const REGISTRY: Record<string, SgiProcessMapTemplate> = {
  comercial: COMERCIAL,
  industrial: INDUSTRIAL,
  servicios: SERVICIOS,
  logistica: LOGISTICA,
  iso9001: ISO9001,
  iatf16949: IATF16949,
};

const CATEGORY: Record<string, 'INDUSTRIA' | 'NORMA'> = {
  comercial: 'INDUSTRIA', industrial: 'INDUSTRIA', servicios: 'INDUSTRIA', logistica: 'INDUSTRIA', iso9001: 'NORMA', iatf16949: 'NORMA',
};

export function listBaseTemplates(): BaseTemplateMeta[] {
  return Object.entries(REGISTRY).map(([key, t]) => ({
    key,
    name: t.map.name,
    description: t.map.description ?? '',
    category: CATEGORY[key],
    processCount: t.processes.length,
  }));
}

export function getBaseTemplate(key: string): SgiProcessMapTemplate | null {
  const t = REGISTRY[key];
  if (!t) return null;
  return { ...t, sgi360: { ...t.sgi360, exportedAt: new Date().toISOString() } };
}
