'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getCookieConsent } from './CookieConsent';

const ADS_ID = 'AW-18147230024';

/**
 * Google Ads / gtag — SOLO se carga si el usuario aceptó cookies
 * en el banner de consentimiento (CookieConsent). Cumple ePrivacy/GDPR.
 */
export default function Analytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Estado inicial: si ya había consentimiento previo, activar
    if (getCookieConsent() === 'accepted') setEnabled(true);

    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEnabled(detail === 'accepted');
    };
    window.addEventListener('lg:cookie-consent', onConsent);
    return () => window.removeEventListener('lg:cookie-consent', onConsent);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${ADS_ID}');
        `}
      </Script>
    </>
  );
}
