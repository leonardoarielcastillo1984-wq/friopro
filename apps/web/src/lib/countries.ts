// Países soportados para workspaces multi-país (espejo de COUNTRIES en
// apps/api/src/routes/workspaces.ts — mantener sincronizado).
export const COUNTRIES: Record<string, { name: string; flag: string }> = {
  AR: { name: 'Argentina', flag: '🇦🇷' },
  CL: { name: 'Chile', flag: '🇨🇱' },
  BR: { name: 'Brasil', flag: '🇧🇷' },
  UY: { name: 'Uruguay', flag: '🇺🇾' },
  PY: { name: 'Paraguay', flag: '🇵🇾' },
  BO: { name: 'Bolivia', flag: '🇧🇴' },
  PE: { name: 'Perú', flag: '🇵🇪' },
  EC: { name: 'Ecuador', flag: '🇪🇨' },
  CO: { name: 'Colombia', flag: '🇨🇴' },
  VE: { name: 'Venezuela', flag: '🇻🇪' },
  MX: { name: 'México', flag: '🇲🇽' },
  US: { name: 'Estados Unidos', flag: '🇺🇸' },
  ES: { name: 'España', flag: '🇪🇸' },
};

export function countryName(code?: string | null): string | null {
  return code ? COUNTRIES[code]?.name ?? code : null;
}

export function countryFlag(code?: string | null): string | null {
  return code ? COUNTRIES[code]?.flag ?? '🌐' : null;
}
