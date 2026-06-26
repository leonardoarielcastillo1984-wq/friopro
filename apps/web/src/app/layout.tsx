import './globals.css';
import '@/styles/2fa.css';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import Script from 'next/script';

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
  title: 'SGI 360',
  description: 'Sistema de Gestión Integrado — Control y Mejora Continua',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  themeColor: '#2563eb',
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
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18147230024"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18147230024');
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-neutral-100/50 font-sans text-neutral-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
