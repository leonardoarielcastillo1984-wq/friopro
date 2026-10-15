import type { ReactNode } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { BUSINESS, LEGAL_LINKS } from '@/lib/legal';

export const metadata = {
  title: 'Legal — Logismart',
};

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">LOGISMART</span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} {BUSINESS.name}. Todos los derechos reservados.</p>
          <nav aria-label="Enlaces legales" className="flex flex-wrap items-center gap-4">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-xs text-slate-500 hover:text-orange-600 transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
