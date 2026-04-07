import './globals.css';
import '@/styles/2fa.css';
import type { ReactNode } from 'react';
import './globals.css';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';

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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-neutral-100/50 font-sans text-neutral-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
