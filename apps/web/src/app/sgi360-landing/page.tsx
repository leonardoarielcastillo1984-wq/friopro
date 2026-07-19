'use client';

import Link from 'next/link';
import {
  Shield, ClipboardCheck, BarChart3, AlertTriangle, Users,
  Zap, FileText, Target, TrendingUp, CheckSquare, ArrowLeft,
} from 'lucide-react';
import UnifiedModuleHero from '@/components/UnifiedModuleHero';

const FEATURES = [
  { icon: Shield, title: 'Gestión de Riesgos', desc: 'Identificación, evaluación y control de riesgos y oportunidades según ISO 9001/14001/45001.' },
  { icon: ClipboardCheck, title: 'Auditorías ISO', desc: 'Planificación anual, ejecución de auditorías internas y seguimiento de hallazgos.' },
  { icon: BarChart3, title: 'Indicadores de Desempeño', desc: 'Tablero de KPIs con metas, tendencias y alertas automáticas de desvíos.' },
  { icon: AlertTriangle, title: 'No Conformidades', desc: 'Registro, análisis de causa raíz y cierre de no conformidades con trazabilidad completa.' },
  { icon: CheckSquare, title: 'Acciones CAPA', desc: 'Gestión de acciones correctivas, preventivas y de mejora con seguimiento de cumplimiento.' },
  { icon: FileText, title: 'Documentos Controlados', desc: 'Control de versiones, aprobaciones digitales y distribución de documentos del SGI.' },
  { icon: Target, title: 'Objetivos de Calidad', desc: 'Planificación, seguimiento y cierre de objetivos ISO alineados a la estrategia organizacional.' },
  { icon: Users, title: 'Capacitación y Competencias', desc: 'Gestión de formación, evaluación de competencias y evidencias por puesto de trabajo.' },
  { icon: TrendingUp, title: 'Revisión por la Dirección', desc: 'Informes ejecutivos, actas y registro de decisiones de la alta dirección.' },
];

export default function SGI360Landing() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-400">LOGISMART</span>
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-green-700">SGI360</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-50/60 to-white"></div>
        <div className="absolute top-20 right-0 w-[520px] h-[520px] bg-gradient-to-br from-green-100/50 to-emerald-100/50 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6">
          <UnifiedModuleHero
            moduleKey="sgi360"
            title="La calidad no es un departamento, es una cultura"
            subtitle="Sistema de Gestión Integrado"
            description="Centralizá ISO 9001, 14001 y 45001 en una sola plataforma. SGI360 te da control total sobre riesgos, auditorías, indicadores y documentación con inteligencia artificial integrada."
            badges={[]}
            colorFrom="from-green-600"
            colorTo="to-emerald-500"
            icon={Shield}
            loginEndpoint="/api/auth/login"
            destination="/dashboard"
            forgotPasswordHref="/sgi360-landing/forgot-password"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">Todo el SGI en un solo lugar</h2>
            <p className="mt-4 text-lg text-slate-500">Una plataforma integrada para gestionar la calidad, el ambiente y la seguridad de tu organización.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:border-green-100 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">{feat.title}</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-r from-green-600 to-emerald-500">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white">¿Listo para gestionar la calidad sin fricción?</h2>
          <p className="mt-4 text-green-100 text-lg">Implementá tu SGI digital en días. Cumplí ISO 9001, 14001 y 45001 con trazabilidad total.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="px-8 py-4 bg-white text-green-700 rounded-2xl font-bold text-sm hover:shadow-xl transition-all">
              Ingresar a SGI360
            </Link>
            <Link href="/" className="px-8 py-4 border-2 border-white/30 text-white rounded-2xl text-sm font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver a LOGISMART
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">SGI360</span>
            <span className="text-slate-500 text-xs ml-2">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
