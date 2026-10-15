'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'lg_cookie_consent';

export type CookieConsentValue = 'accepted' | 'rejected';

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === 'accepted' || v === 'rejected' ? v : null;
}

export function setCookieConsent(v: CookieConsentValue) {
  window.localStorage.setItem(CONSENT_KEY, v);
  // Avisar al resto de la app (Analytics escucha este evento)
  window.dispatchEvent(new CustomEvent('lg:cookie-consent', { detail: v }));
}

/**
 * Banner de consentimiento de cookies — RGPD/ePrivacy + Ley 25.326 (AR).
 * Bloquea la carga de Google Ads (gtag) hasta que el usuario acepta.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mostrar solo si no hay decisión previa registrada
    if (getCookieConsent() === null) setVisible(true);
  }, []);

  const decide = (v: CookieConsentValue) => {
    setCookieConsent(v);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 inset-x-0 z-[100] border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-2xl"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-900 text-sm mb-0.5">Usamos cookies</p>
            <p>
              Utilizamos cookies propias y de terceros (Google) para analizar el tráfico y mejorar tu
              experiencia. Podés aceptarlas o rechazarlas; las esenciales siempre están activas porque
              son necesarias para que el sitio funcione. Más info en nuestra{' '}
              <Link href="/legal/cookies" className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
                Política de Cookies
              </Link>{' '}
              y{' '}
              <Link href="/legal/privacidad" className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700">
                Política de Privacidad
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => decide('rejected')}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Rechazar
          </button>
          <button
            onClick={() => decide('accepted')}
            className="px-5 py-2 rounded-full text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm"
          >
            Aceptar todas
          </button>
          <button
            onClick={() => decide('rejected')}
            aria-label="Cerrar aviso de cookies"
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
