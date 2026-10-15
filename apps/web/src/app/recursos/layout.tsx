import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { absolute: 'Recursos — Guías y comparativas sobre SGI, ISO e IATF | SGI360' },
  description:
    'Guías prácticas sobre sistemas de gestión integrados, ISO 9001/14001/45001, IATF 16949, core tools automotrices y gestión de flota — escritas por el equipo de SGI360.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://logismart.ar/recursos' },
};

export default function RecursosLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-400">LOGISMART</span>
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-500">
                <Shield className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-green-700">SGI360</span>
              <span className="ml-1 text-xs font-medium uppercase tracking-wider text-slate-400">Recursos</span>
            </div>
          </div>
          <Link
            href="/sgi360-landing"
            className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
          >
            Probar gratis
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-100 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-500">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">SGI360</span>
            <span className="text-xs text-slate-500">by LOGISMART</span>
          </div>
          <nav aria-label="Enlaces" className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <Link href="/sgi360-landing" className="hover:text-slate-900">Producto</Link>
            <Link href="/recursos" className="hover:text-slate-900">Recursos</Link>
            <Link href="/legal/privacidad" className="hover:text-slate-900">Privacidad</Link>
            <Link href="/legal/terminos" className="hover:text-slate-900">Términos</Link>
          </nav>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
