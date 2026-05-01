'use client';

import Link from 'next/link';
import { Zap, Shield, ShieldCheck, ClipboardCheck, Truck, Lock, ArrowLeft } from 'lucide-react';

const modules = [
  {
    key: 'sgi360',
    title: 'SGI360',
    subtitle: 'Sistema de Gestión Integrado',
    description: 'Gestion normas ISO, procesos, documentos, riesgos, acciones y mucho mas.',
    icon: Shield,
    color: 'text-amber-400',
    bgIcon: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    badge: 'Disponible',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    available: true,
    href: '/dashboard',
  },
  {
    key: 'seh360',
    title: 'SEH360',
    subtitle: 'Seguridad e Higiene',
    description: 'Gestion de seguridad laboral, higiene, capacitaciones e incidentes.',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bgIcon: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    badge: 'Proximamente',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    available: false,
    href: '#',
  },
  {
    key: 'audit360',
    title: 'AUDIT360',
    subtitle: 'Auditorias Inteligentes',
    description: 'Herramientas para auditores y consultores de calidad.',
    icon: ClipboardCheck,
    color: 'text-blue-400',
    bgIcon: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    badge: 'Proximamente',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    available: false,
    href: '#',
  },
  {
    key: 'flota360',
    title: 'FLOTA360',
    subtitle: 'Gestion de Flota',
    description: 'Control y mantenimiento de flota, inspecciones y costos.',
    icon: Truck,
    color: 'text-cyan-400',
    bgIcon: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    badge: 'Proximamente',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    available: false,
    href: '#',
  },
];

export default function SuitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 mb-4 shadow-lg shadow-orange-500/30">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Suite <span className="text-orange-400">360</span></h1>
        <p className="text-slate-300 mt-2 text-lg">Tu ecosistema integral de gestion</p>
        <p className="text-slate-400 mt-1 text-sm">Selecciona el modulo con el que deseas trabajar</p>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.key}
              className={`relative rounded-2xl border bg-slate-800/60 backdrop-blur-sm p-6 transition-all hover:bg-slate-800/80 ${mod.borderColor} ${
                mod.available ? 'shadow-lg shadow-amber-500/10' : 'opacity-90'
              }`}
            >
              {/* Lock badge for unavailable */}
              {!mod.available && (
                <div className="absolute top-4 right-4">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl ${mod.bgIcon} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${mod.color}`} />
              </div>

              {/* Title & Subtitle */}
              <h2 className={`text-xl font-bold ${mod.color}`}>{mod.title}</h2>
              <p className="text-white font-medium text-sm mt-1">{mod.subtitle}</p>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">{mod.description}</p>

              {/* Badge */}
              <div className="mt-5">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${mod.badgeClass}`}>
                  {mod.badge}
                </span>
              </div>

              {/* CTA */}
              <div className="mt-4">
                {mod.available ? (
                  <Link
                    href={mod.href}
                    className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-bold text-sm hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg shadow-amber-500/20"
                  >
                    Ingresar al modulo
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-slate-700/50 text-slate-500 font-medium text-sm cursor-not-allowed border border-slate-600/30"
                  >
                    Proximamente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-10">
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
