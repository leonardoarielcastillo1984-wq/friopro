'use client';

import Link from 'next/link';
import {
  Truck, Wrench, Fuel, ClipboardCheck, Bell, Shield,
  Zap, QrCode, Brain, Calendar,
  FileText, Users, ArrowLeft
} from 'lucide-react';
import UnifiedModuleHero from '@/components/UnifiedModuleHero';

const FEATURES = [
  { icon: Wrench, title: 'Mantenimientos Inteligentes', desc: 'Programación automática, historial completo y alertas por condición real de cada unidad.' },
  { icon: QrCode, title: 'Checklists QR', desc: 'Inspecciones pre y post viaje con evidencia fotográfica desde el celular del chofer.' },
  { icon: Fuel, title: 'Consumo & Combustible', desc: 'Registro de cargas, desvíos de consumo y cálculo de rendimiento por ruta y conductor.' },
  { icon: FileText, title: 'Documentos & Vencimientos', desc: 'Seguros, VTV, licencias y habilitaciones con alertas tempranas y respaldo digital.' },
  { icon: Brain, title: 'IA Predictiva', desc: 'Modelos que anticipan fallas, priorizan órdenes de trabajo y recomiendan acciones.' },
  { icon: Users, title: 'Gestión de Conductores', desc: 'Scoring, licencias, asignación de vehículos y seguimiento de performance.' },
  { icon: Bell, title: 'Alertas Operativas', desc: 'Notificaciones automáticas de incidencias, paradas imprevistas y desvíos críticos.' },
  { icon: ClipboardCheck, title: 'Órdenes & Taller', desc: 'Flujo completo de órdenes, repuestos, costos y aprobación multi-equipo.' },
  { icon: Calendar, title: 'Neumáticos & Activos', desc: 'Trazabilidad neumática, rotaciones, vida útil y stock de activos críticos.' },
  { icon: Shield, title: 'Seguridad Vial', desc: 'Planes de contingencia, checklist de seguridad y protocolos para cada operación.' },
];

export default function Flota360Landing() {
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-blue-600">FLOTA360</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/flota360/" className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 to-white"></div>
        <div className="absolute top-20 right-0 w-[520px] h-[520px] bg-gradient-to-br from-blue-100/50 to-cyan-100/50 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6">
          <UnifiedModuleHero
            moduleKey="flota360"
            title="La operación no se improvisa"
            subtitle="Ecosistema Operativo de Flota"
            description="Centralizá mantenimiento, combustible, conductores y documentación en un solo panel. Flota360 te da trazabilidad total, alertas en tiempo real e inteligencia predictiva."
            badges={[]}
            colorFrom="from-blue-500"
            colorTo="to-cyan-500"
            icon={Truck}
            loginEndpoint="/api/flota360/auth/login"
            signupEndpoint="/api/flota360/auth/signup"
            destination="/flota360/"
            forgotPasswordHref="/flota360-landing/forgot-password"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">Orquestá toda tu flota</h2>
            <p className="mt-4 text-lg text-slate-500">Una única plataforma para mantenimiento, operación y decisiones de IA.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-blue-600" />
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
      <section className="py-24 bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white">¿Listo para operar sin fricciones?</h2>
          <p className="mt-4 text-blue-100 text-lg">Automatizá la gestión de tu flota y activá la IA predictiva en días, no en meses.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/flota360/" className="px-8 py-4 bg-white text-blue-700 rounded-2xl font-bold text-sm hover:shadow-xl transition-all">
              Ingresar a FLOTA360
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">FLOTA360</span>
            <span className="text-slate-500 text-xs ml-2">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© 2024 LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
