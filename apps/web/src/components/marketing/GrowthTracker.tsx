'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track, trackReferralClick } from '@/lib/track';

// Primer segmento de las rutas internas del SaaS (grupo app/(app)).
// El tracking del funnel solo tiene sentido en páginas públicas;
// la navegación autenticada no es "acquisition".
const APP_SEGMENTS = new Set([
  'acciones','activos','admin','ambientales','audit','audit360','auditoria',
  'auditoria-readiness','auditorias','billing','calendario','calibraciones',
  'calidad','capacitaciones','centro-empresa','clientes','clima',
  'command-center','configuracion','contexto','contexto-sgi','core-tools',
  'cumplimiento','dashboard','dashboard-simple','demo-welcome','digital-twin',
  'documents','encuestas','flota-360','gestion-cambios','incidentes',
  'indicadores','infraestructura','integraciones','iperc','legales','licencia',
  'licencias','mantenimiento','minutas','modo-de-uso','no-conformidades',
  'normativos','notificaciones','objetivos','onboarding','panel',
  'partes-interesadas','plan-accion','plan-selection','planes','plans',
  'project360','proveedores','proyectos','reportes','requisitos-legales',
  'resultados','revision-direccion','riesgos','rrhh','seguridad',
  'seguridad360','select-tenant','simulacros',
]);

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
const REF_KEY = 'sgi_ref';
const UTM_KEY = 'sgi_first_utm';

/** Lee el código de referido persistido (set por GrowthTracker al entrar con ?ref=). */
export function getReferralCode(): string | undefined {
  try { return localStorage.getItem(REF_KEY) || undefined; } catch { return undefined; }
}

/** Limpia el código persistido — llamar tras un registro exitoso para no re-atribuir. */
export function clearReferralCode() {
  try { localStorage.removeItem(REF_KEY); } catch { /* noop */ }
}

/** UTMs de primer toque — persistidas para LeadCapture en páginas sin params. */
export function getStoredUtms(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}'); } catch { return {}; }
}

export default function GrowthTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Captura ?ref= una sola vez (persiste hasta el registro) ──
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && /^[a-z0-9]{4,40}$/i.test(ref)) {
      try {
        if (localStorage.getItem(REF_KEY) !== ref) {
          localStorage.setItem(REF_KEY, ref);
          trackReferralClick(ref);
        }
      } catch { /* noop */ }
    }
    // UTMs de primer toque: solo guardar si hay alguno y no existen ya
    try {
      if (!sessionStorage.getItem(UTM_KEY)) {
        const utms: Record<string, string> = {};
        for (const k of UTM_KEYS) {
          const v = searchParams.get(k);
          if (v) utms[k] = v;
        }
        if (Object.keys(utms).length) sessionStorage.setItem(UTM_KEY, JSON.stringify(utms));
      }
    } catch { /* noop */ }
  }, [searchParams]);

  // ── PAGE_VIEW en cada navegación pública ──
  useEffect(() => {
    if (!pathname) return;
    const seg = pathname.split('/')[1] || '';
    if (APP_SEGMENTS.has(seg)) return;

    const meta: Record<string, unknown> = {};
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host) {
        meta.referrerHost = new URL(document.referrer).host;
      }
    } catch { /* noop */ }
    track('PAGE_VIEW', pathname, meta);

    // Herramientas gratuitas tienen su propio evento además del pageview
    if (pathname.startsWith('/herramientas/') && pathname.split('/').length > 2) {
      track('TOOL_VIEW', pathname);
    }
    if (pathname === '/register' || pathname === '/register-company') {
      track('REGISTER_STARTED', pathname);
    }
    if (pathname === '/validate-doc') {
      track('VALIDATE_DOC', pathname);
    }
  }, [pathname]);

  return null;
}
