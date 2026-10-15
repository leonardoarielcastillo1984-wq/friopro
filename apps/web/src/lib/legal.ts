/**
 * Datos legales y de contacto del negocio — fuente única de verdad.
 * Usado por páginas legales públicas (/legal/*), footers, formularios
 * de consentimiento y el banner de cookies.
 */
export const BUSINESS = {
  name: 'Logismart',
  legalName: 'Logismart',
  email: 'soporte@logismart.ar',
  privacyEmail: 'privacidad@logismart.ar',
  whatsapp: '+54 11 6616-9368',
  whatsappIntl: '541166169368',
  location: 'Buenos Aires, Argentina',
  jurisdiction: 'Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires',
} as const;

export const LEGAL_LAST_UPDATED = '10 de octubre de 2026';

export const LEGAL_LINKS = [
  { href: '/legal/aviso', label: 'Aviso Legal' },
  { href: '/legal/privacidad', label: 'Política de Privacidad' },
  { href: '/legal/terminos', label: 'Términos y Condiciones' },
  { href: '/legal/cookies', label: 'Política de Cookies' },
  { href: '/legal/reembolsos', label: 'Política de Reembolsos' },
  { href: '/legal/ia', label: 'Aviso sobre IA' },
] as const;
