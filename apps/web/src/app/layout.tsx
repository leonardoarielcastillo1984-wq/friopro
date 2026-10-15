import './globals.css';
import '@/styles/2fa.css';
import '@/lib/dates';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import Analytics from '@/components/Analytics';
import CookieConsent from '@/components/CookieConsent';

// La app es 100% autenticada/dinámica: evitamos el prerender estático en build
// (que falla con useSearchParams sin Suspense y APIs client-only).
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL('https://logismart.ar'),
  title: {
    default: 'SGI360 — Sistema de Gestión Integrado | LOGISMART',
    template: '%s | SGI360',
  },
  description:
    'SGI360 by LOGISMART — plataforma de gestión integrada (SGI/QHSE) para ISO 9001, 14001, 45001 e IATF 16949 con core tools automotrices (APQP, PPAP, FMEA, MSA, SPC), gestión de riesgos, auditorías, documentos, gestión de flota y resultados de negocio con IA integrada.',
  keywords: [
    'SGI360', 'LOGISMART', 'sistema de gestión integrado', 'software ISO 9001',
    'QHSE', 'IATF 16949', 'core tools', 'APQP', 'PPAP', 'FMEA', 'MSA', 'SPC',
    'auditorías internas', 'no conformidades', 'gestión de riesgos',
    'gestión de flota', 'documentos controlados', 'indicadores',
    'software Chile', 'software Argentina',
  ],
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  openGraph: {
    siteName: 'SGI360 by LOGISMART',
    locale: 'es_LA',
    type: 'website',
    title: 'SGI360 — Sistema de Gestión Integrado',
    description:
      'Centralizá calidad, seguridad y medio ambiente en una sola plataforma con IA integrada.',
    images: [
      { url: '/og-cover.jpg', width: 1200, height: 630, alt: 'SGI360 — Sistema de Gestión Integrado con core tools IATF, gestión de flota y riesgos' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SGI360 — Sistema de Gestión Integrado',
    description:
      'SGI/QHSE para ISO 9001, 14001, 45001 e IATF 16949: core tools, flota, riesgos e IA.',
    images: ['/og-cover.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
  },
  appleWebApp: {
    capable: true,
    title: 'SGI 360',
    statusBarStyle: 'default',
  },
  other: {
    'google-ads-verification': 'AW-18147230024',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-neutral-100/50 font-sans text-neutral-900 antialiased">
        <Providers>{children}</Providers>
        {/* Google Ads solo carga si el usuario acepta cookies (Analytics) */}
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
