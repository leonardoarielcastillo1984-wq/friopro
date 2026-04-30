// Diccionario de traducciones: valores técnicos de la BD → español
export const DICT: Record<string, Record<string, string>> = {
  stakeholderType: {
    INTERNAL: 'Interna',
    EXTERNAL: 'Externa',
  },
  stakeholderCategory: {
    EMPLOYEE: 'Empleado',
    CUSTOMER: 'Cliente',
    SUPPLIER: 'Proveedor',
    COMMUNITY: 'Comunidad',
    REGULATOR: 'Regulador',
    SHAREHOLDER: 'Accionista',
    OTHER: 'Otro',
  },
  complianceStatus: {
    COMPLIES: 'Cumple',
    PARTIAL: 'Parcial',
    NON_COMPLIANT: 'No cumple',
  },
  ncrSeverity: {
    CRITICAL: 'Crítica',
    MAJOR: 'Mayor',
    MINOR: 'Menor',
    OBSERVATION: 'Observación',
  },
  ncrSource: {
    INTERNAL_AUDIT: 'Auditoría Interna',
    EXTERNAL_AUDIT: 'Auditoría Externa',
    CUSTOMER_COMPLAINT: 'Reclamo de Cliente',
    PROCESS_DEVIATION: 'Desviación de Proceso',
    SUPPLIER_ISSUE: 'Problema de Proveedor',
    AI_FINDING: 'Hallazgo IA',
    OTHER: 'Otro',
    STAKEHOLDER: 'Parte Interesada',
  },
  ncrStatus: {
    OPEN: 'Abierta',
    IN_ANALYSIS: 'En Análisis',
    ACTION_PLANNED: 'Acción Planeada',
    IN_PROGRESS: 'En Progreso',
    VERIFICATION: 'Verificación',
    CLOSED: 'Cerrada',
    CANCELLED: 'Cancelada',
  },
};

export function t(dictKey: keyof typeof DICT, value?: string | null): string {
  if (!value) return '—';
  return DICT[dictKey]?.[value] ?? value;
}
