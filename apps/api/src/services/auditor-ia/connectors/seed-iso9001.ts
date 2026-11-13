// ──────────────────────────────────────────────────────────────
// Tabla semilla ISO 9001:2015 — cláusula → conectores sugeridos.
// La persona la edita en P2 (spec §6). Claves por prefijo de
// clauseNumber: "9.2" aplica a 9.2.x; la coincidencia más larga gana.
// ──────────────────────────────────────────────────────────────

const MAP: Record<string, string[]> = {
  '4.1': ['context'],
  '4.2': ['context'],
  '4.3': ['documents', 'context'],
  '4.4': ['documents', 'indicators'],
  '5.1': ['management_review', 'documents'],
  '5.2': ['documents'],
  '5.3': ['competence', 'documents'],
  '6.1': ['risks', 'documents'],
  '6.2': ['objectives', 'indicators'],
  '6.3': ['documents'],
  '7.1': ['indicators', 'documents'],
  '7.2': ['competence'],
  '7.3': ['competence'],
  '7.4': ['documents'],
  '7.5': ['documents'],
  '8.1': ['documents', 'risks'],
  '8.2': ['documents', 'ncr'],
  '8.3': ['documents'],
  '8.4': ['suppliers', 'documents'],
  '8.5': ['documents', 'indicators'],
  '8.6': ['documents', 'indicators'],
  '8.7': ['ncr', 'documents'],
  '9.1': ['indicators', 'documents'],
  '9.2': ['internal_audits'],
  '9.3': ['management_review'],
  '10.1': ['objectives', 'documents'],
  '10.2': ['ncr'],
  '10.3': ['objectives', 'ncr', 'indicators'],
};

/**
 * Devuelve las claves de conector sugeridas para una cláusula.
 * Coincidencia por prefijo más específico. Si no hay regla,
 * devuelve ['documents'] como mínimo viable.
 */
export function suggestedConnectorKeys(clauseNumber: string): string[] {
  let best: string[] | null = null;
  let bestLen = -1;
  for (const [prefix, keys] of Object.entries(MAP)) {
    if (
      (clauseNumber === prefix || clauseNumber.startsWith(prefix + '.')) &&
      prefix.length > bestLen
    ) {
      best = keys;
      bestLen = prefix.length;
    }
  }
  return best ?? ['documents'];
}
