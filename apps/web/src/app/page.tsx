'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap, Shield, ShieldCheck, ClipboardCheck, Truck, AlertTriangle,
  ArrowRight, CheckCircle, TrendingUp, Brain, BarChart3, Globe,
  Users, Lock, FileCheck, Layers, ChevronDown, ChevronRight,
  Phone, Mail, MapPin, Linkedin, Twitter, Play, Star,
  Activity, Target, Cpu, Sparkles, ArrowUpRight, Cloud,
  Rocket, Headphones, RefreshCw, Package
} from 'lucide-react';
import './landing.css';

const PRODUCTS = [
  {
    key: 'sgi360',
    title: 'SGI360',
    subtitle: 'Gestión Integral',
    description: 'Gestioná normas ISO, procesos, documentos, riesgos y mucho más.',
    icon: Shield,
    color: 'bg-orange-500',
    lightBg: 'bg-orange-50',
    textColor: 'text-orange-600',
    href: '/sgi360-landing',
    loginHref: '/login',
    available: true,
  },
  {
    key: 'seh360',
    title: 'SEH360',
    subtitle: 'Seguridad e Higiene',
    description: 'Gestioná la seguridad laboral, higiene, capacitaciones e incidentes.',
    icon: ShieldCheck,
    color: 'bg-emerald-500',
    lightBg: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    href: '/seh360-landing',
    loginHref: '/seh360/login',
    available: true,
  },
  {
    key: 'audit360',
    title: 'AUDIT360',
    subtitle: 'Auditorías Inteligentes',
    description: 'Planificá y ejecutá auditorías internas y externas de forma simple.',
    icon: ClipboardCheck,
    color: 'bg-blue-500',
    lightBg: 'bg-blue-50',
    textColor: 'text-blue-600',
    href: '/audit360-landing',
    loginHref: '/login-audit360',
    available: true,
  },
  {
    key: 'flota360',
    title: 'FLOTA360',
    subtitle: 'Gestión de Flota',
    description: 'Controlá y mantené tu flota, conductores, costos y documentación.',
    icon: Truck,
    color: 'bg-cyan-500',
    lightBg: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    href: '/flota360-landing',
    loginHref: 'https://test.logismart.ar/flota360/login/',
    available: true,
  },
  {
    key: 'siniestros360',
    title: 'SINIESTROS360',
    subtitle: 'Gestión de Siniestros',
    description: 'Registrá, gestioná y hacé seguimiento de siniestros y reclamos.',
    icon: AlertTriangle,
    color: 'bg-rose-500',
    lightBg: 'bg-rose-50',
    textColor: 'text-rose-600',
    href: '/siniestros360-landing',
    loginHref: '/login-siniestros360',
    available: true,
  },
  {
    key: 'proyect360',
    title: 'PROYECT360',
    subtitle: 'Gestión de Proyectos',
    description: 'Planificá, asigná tareas y hacé seguimiento de objetivos de tus proyectos.',
    icon: Layers,
    color: 'bg-indigo-500',
    lightBg: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    href: '/proyect360-landing',
    loginHref: '/login',
    available: true,
  },
];


const MODULE_DETAILS_MAP: Record<string, {
  title: string;
  subtitle: string;
  badge: string;
  colorClass: string;
  features: string[];
  capabilities: { title: string; desc: string }[];
}> = {
  sgi360: {
    title: 'SGI360',
    subtitle: 'Sistema de Gestión Integral',
    badge: 'Normas ISO & Procesos',
    colorClass: 'text-orange-500 border-orange-500 bg-orange-500/10',
    features: [
      'Control Documental Inteligente (ISO 9001, 14001, 45001)',
      'Identificación y Evaluación de Riesgos Corporativos',
      'Planes de Acción correctivos y preventivos integrados',
      'Registro de No Conformidades con flujos de aprobación'
    ],
    capabilities: [
      { title: 'Aprobaciones en un click', desc: 'Flujo de firmas digitales para documentos de calidad.' },
      { title: 'Trazabilidad completa', desc: 'Historial detallado de cambios y revisiones por norma.' }
    ]
  },
  seh360: {
    title: 'SEH360',
    subtitle: 'Seguridad e Higiene Laboral',
    badge: 'Salud Ocupacional',
    colorClass: 'text-emerald-600 border-emerald-500 bg-emerald-500/10',
    features: [
      'Control de Entrega y Stock de EPP (Vencimientos y Talles)',
      'Matriz de Evaluación de Riesgos por Puesto (IPER)',
      'Gestión de Capacitaciones obligatorias con asistencia',
      'Registro y análisis de Incidentes y Accidentes de trabajo'
    ],
    capabilities: [
      { title: 'Alertas de Vencimiento', desc: 'Notificaciones push antes del vencimiento de un EPP.' },
      { title: 'Reporte móvil in-situ', desc: 'Carga de incidentes en tiempo real desde celulares.' }
    ]
  },
  audit360: {
    title: 'AUDIT360',
    subtitle: 'Auditorías de Calidad y Procesos',
    badge: 'Inspecciones Inteligentes',
    colorClass: 'text-blue-600 border-blue-500 bg-blue-500/10',
    features: [
      'Planificación de programas anuales de auditoría',
      'Listas de verificación y checklists customizables',
      'Registro fotográfico de hallazgos directamente desde el móvil',
      'Generación automatizada de reportes PDF descargables'
    ],
    capabilities: [
      { title: 'Checklists offline', desc: 'Llená las inspecciones sin conexión a internet en planta.' },
      { title: 'Estadísticas inmediatas', desc: 'Gráficos automáticos de porcentaje de cumplimiento.' }
    ]
  },
  flota360: {
    title: 'FLOTA360',
    subtitle: 'Control de Vehículos y Conductores',
    badge: 'Gestión Logística',
    colorClass: 'text-cyan-600 border-cyan-500 bg-cyan-500/10',
    features: [
      'Mantenimientos preventivos programados por Km/Día',
      'Monitoreo detallado de consumo y carga de combustible',
      'Vencimientos de seguros, patentes, VTV y licencias',
      'Asignación eficiente de conductores y hojas de ruta'
    ],
    capabilities: [
      { title: 'Evitá multas de tránsito', desc: 'Alertas preventivas de licencias próximas a expirar.' },
      { title: 'Análisis de costos', desc: 'Cálculo de costo operativo por kilómetro de cada vehículo.' }
    ]
  },
  siniestros360: {
    title: 'SINIESTROS360',
    subtitle: 'Gestión de Siniestros y Reclamos',
    badge: 'Seguimiento Legal & Pólizas',
    colorClass: 'text-rose-600 border-rose-500 bg-rose-500/10',
    features: [
      'Denuncia digital de siniestros viales y edilicios',
      'Seguimiento legal de reclamaciones y mediaciones',
      'Control de tasaciones y presupuestos de aseguradoras',
      'Centralización de pólizas de seguro vigentes e históricas'
    ],
    capabilities: [
      { title: 'Denuncia rápida', desc: 'Asistente paso a paso para la toma de datos tras un choque.' },
      { title: 'Historial de pagos', desc: 'Trazabilidad de montos cobrados frente a los reclamados.' }
    ]
  },
  proyect360: {
    title: 'PROYECT360',
    subtitle: 'Gestión de Objetivos y Proyectos',
    badge: 'Metodología Ágil',
    colorClass: 'text-indigo-600 border-indigo-500 bg-indigo-500/10',
    features: [
      'Tableros Kanban dinámicos e intuitivos por proyecto',
      'Diagramas de Gantt interactivos para medir tiempos',
      'Asignación ágil de tareas con responsables y fechas límite',
      'Reportes visuales del progreso general y objetivos del mes'
    ],
    capabilities: [
      { title: 'Metas Claras', desc: 'Dividí proyectos grandes en hitos y entregas semanales.' },
      { title: 'Colaboración efectiva', desc: 'Muro de comentarios y adjuntos directamente en las tarjetas.' }
    ]
  }
};

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedModule, setSelectedModule] = useState('sgi360');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('sr-visible');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.sr-fade').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* ═══ HEADER ═══ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-lg shadow-sm' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">LOGISMART</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            <a href="#modulos" className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Módulos</a>
            <a href="#planes" className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Planes</a>
            <a href="#tecnologia" className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Tecnología</a>
            <a href="#contacto" className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">Contacto</a>
          </nav>



          <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden p-2">
            <div className="space-y-1.5">
              <div className="w-6 h-0.5 bg-slate-700"></div>
              <div className="w-6 h-0.5 bg-slate-700"></div>
              <div className="w-4 h-0.5 bg-slate-700"></div>
            </div>
          </button>
        </div>
        {mobileMenu && (
          <div className="lg:hidden bg-white border-t border-slate-100 p-4 space-y-3">
            <a href="#modulos" className="block text-sm font-medium text-slate-700 py-2">Módulos</a>
            <a href="#planes" className="block text-sm font-medium text-slate-700 py-2">Planes</a>
            <a href="#contacto" className="block text-sm font-medium text-slate-700 py-2">Contacto</a>

          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section className="pt-28 pb-16 lg:pt-36 lg:pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-orange-50 via-amber-50/50 to-transparent rounded-full -translate-y-1/4 translate-x-1/4"></div>

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full mb-6">
                <Zap className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Tu ecosistema integral de gestión</span>
              </div>

              <h1 className="text-4xl lg:text-[3.5rem] font-bold text-slate-900 leading-[1.1]">
                Un ecosistema.<br />
                <span className="text-orange-500 italic">Infinitas</span> posibilidades.
              </h1>

              <p className="mt-5 text-lg text-slate-500 leading-relaxed max-w-md">
                Software modular para gestionar calidad, seguridad, auditorías, flotas, siniestros y más. <span className="text-orange-500 font-medium">Todo conectado. Todo simple.</span>
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#modulos" className="px-6 py-3 bg-orange-500 text-white rounded-full text-sm font-semibold hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-200 transition-all flex items-center gap-2">
                  Conocé los módulos <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#planes" className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-semibold hover:border-slate-300 hover:shadow-sm transition-all">
                  Ver planes
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex flex-wrap items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Package className="w-4 h-4 text-slate-400" /> 100% Modular</span>
                <span className="flex items-center gap-1.5"><Cloud className="w-4 h-4 text-slate-400" /> En la nube</span>
                <span className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-slate-400" /> Seguro</span>
                <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-slate-400" /> Escalable</span>
              </div>
            </div>

            {/* Right - 6 Interactive Modules Grid (2x3 Grid Layout) */}
            <div className="relative">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {PRODUCTS.map((product) => {
                  const Icon = product.icon;
                  return (
                    <Link
                      key={product.key}
                      href={product.href}
                      className="group bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-xl hover:border-slate-200 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div>
                        <div className={`w-10 h-10 rounded-xl ${product.color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="w-5.5 h-5.5 text-white" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">{product.title}</h3>
                        <p className={`text-[11px] font-medium ${product.textColor} mt-0.5`}>{product.subtitle}</p>
                        <p className="text-[11px] text-slate-400 mt-2 leading-snug group-hover:text-slate-500 transition-colors line-clamp-2">{product.description}</p>
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-orange-500 group-hover:translate-x-1 transition-transform duration-300">
                        Ingresar <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </Link>
                  );
                })}
              </div>
              {/* Decorative design elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-orange-100/40 to-amber-100/40 rounded-full blur-3xl -z-10"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-indigo-100/40 to-blue-100/40 rounded-full blur-3xl -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECCIÓN INTERACTIVA: ECOISTEMA INTEGRADO (Dashboard + Ilustración) ═══ */}
      <section id="ecosistema" className="py-20 bg-slate-50/20 border-y border-slate-100/60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#f8fafc_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: ¡Hola, Equipo! Dashboard Simulation */}
            <div className="lg:col-span-6 relative">
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-100 p-6 relative">
                {/* Dashboard Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-bold text-slate-900">¡Hola, Equipo!</p>
                    <p className="text-xs text-slate-400">Este es el resumen de tu gestión</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">Este mes ▾</span>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-5 gap-3 mb-5">
                  {[
                    { label: 'Normas', value: '23', sub: 'Gestionadas', color: 'text-orange-500' },
                    { label: 'No Conformidades', value: '8', sub: 'Abiertas', color: 'text-rose-500' },
                    { label: 'Auditorías', value: '12', sub: 'Programadas', color: 'text-blue-500' },
                    { label: 'Accidentes', value: '3', sub: 'Reportados', color: 'text-amber-500' },
                    { label: 'Vehículos', value: '32', sub: 'Activos', color: 'text-cyan-500' },
                  ].map((kpi, i) => (
                    <div key={i} className="text-center p-2 bg-slate-50/80 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-medium">{kpi.label}</p>
                      <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-[10px] text-slate-400">{kpi.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Two columns */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Activity */}
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">Actividad reciente</p>
                    <div className="space-y-2">
                      {[
                        { dot: 'bg-blue-400', text: 'Auditoría interna completada', sub: 'Planta Central - ISO 9001', time: 'Hace 2 horas' },
                        { dot: 'bg-emerald-400', text: 'Nuevo incidente registrado', sub: 'Depósito Norte - SEH360', time: 'Hace 4 horas' },
                        { dot: 'bg-cyan-400', text: 'Mantenimiento preventivo', sub: 'Vehículo ABC 123 - Flota360', time: 'Hace 6 horas' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.dot} mt-1.5 flex-shrink-0`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{item.text}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.sub}</p>
                          </div>
                          <span className="text-[10px] text-slate-300 flex-shrink-0">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">KPI principales</p>
                      <span className="text-[10px] text-slate-400">Este mes ▾</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Cumplimiento general', value: '86%', trend: '↑ 6%', trendColor: 'text-emerald-500' },
                        { label: 'Acciones cerradas', value: '74%', trend: '↑ 8%', trendColor: 'text-emerald-500' },
                        { label: 'Índice de frecuencia', value: '1.2', trend: '↓ 0.3', trendColor: 'text-emerald-500' },
                        { label: 'Disponibilidad de flota', value: '92%', trend: '↑ 4%', trendColor: 'text-emerald-500' },
                      ].map((kpi, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600">{kpi.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-800">{kpi.value}</span>
                            <span className={`text-[10px] font-medium ${kpi.trendColor}`}>{kpi.trend}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-orange-100/40 rounded-full blur-2xl -z-10"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-blue-100/40 rounded-full blur-2xl -z-10"></div>
            </div>

            {/* Right: Ecosystem explanation */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-100 rounded-full">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider">Modular e Integrado</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 leading-tight">
                Una Suite. Seis aplicaciones.<br />
                <span className="text-orange-500 font-medium">Control absoluto e independiente.</span>
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Logismart no es un software rígido, sino una suite flexible de aplicaciones independientes. Activá únicamente los módulos que tu negocio necesita hoy y escalá sin límites mañana. Cada aplicación cuenta con su propia base de datos, seguridad avanzada y flujo de trabajo.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="flex gap-3 bg-white p-4 rounded-xl border border-slate-100">
                  <Cpu className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Acceso Independiente</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">Cada módulo actúa como una aplicación separada para máxima organización.</p>
                  </div>
                </div>
                <div className="flex gap-3 bg-white p-4 rounded-xl border border-slate-100">
                  <Activity className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Indicadores en Tiempo Real</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">Monitoreá la actividad reciente y los KPIs clave de todo tu ecosistema.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MÓDULOS INTERACTIVOS (Explicación Dinámica al hacer click) ═══ */}
      <section id="modulos" className="py-20 bg-slate-50/50 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Un módulo para cada necesidad</h2>
            <p className="text-xs text-slate-400 mt-2">Hacé clic sobre cualquier módulo para desplegar su explicación detallada y conocer sus funcionalidades.</p>
          </div>

          {/* Cards Row (Cliqueable, no redirects) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
            {PRODUCTS.map((product) => {
              const Icon = product.icon;
              const isSelected = selectedModule === product.key;
              return (
                <button
                  key={product.key}
                  onClick={() => setSelectedModule(product.key)}
                  className={`text-left bg-white rounded-2xl border p-5 transition-all outline-none flex flex-col justify-between h-full group ${
                    isSelected 
                      ? `ring-2 ring-offset-2 shadow-md border-transparent ${product.key === 'sgi360' ? 'ring-orange-500' : product.key === 'seh360' ? 'ring-emerald-500' : product.key === 'audit360' ? 'ring-blue-500' : product.key === 'flota360' ? 'ring-cyan-500' : product.key === 'siniestros360' ? 'ring-rose-500' : 'ring-indigo-500'}` 
                      : 'border-slate-100 hover:shadow-md hover:border-slate-200'
                  }`}
                >
                  <div>
                    <div className={`w-12 h-12 rounded-xl ${product.color} flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{product.title}</h3>
                    <p className={`text-xs font-semibold ${product.textColor} mt-0.5`}>{product.subtitle}</p>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3 group-hover:text-slate-500 transition-colors">{product.description}</p>
                  </div>

                  <div className="mt-5 w-full">
                    <span className={`inline-flex items-center gap-1 w-full justify-center py-2 rounded-full text-xs font-bold transition-all ${
                      isSelected 
                        ? `${product.color} text-white` 
                        : 'bg-slate-50 text-slate-600 group-hover:bg-slate-100'
                    }`}>
                      {isSelected ? 'Ver detalle active' : 'Ver detalle'} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dynamic Accordion Detail Panel */}
          {selectedModule && (
            <div className="mt-10 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left side details */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${MODULE_DETAILS_MAP[selectedModule].colorClass}`}>
                      {MODULE_DETAILS_MAP[selectedModule].badge}
                    </span>
                    <h3 className="text-2xl font-extrabold text-slate-900 mt-3">
                      Funcionalidades de {MODULE_DETAILS_MAP[selectedModule].title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {MODULE_DETAILS_MAP[selectedModule].subtitle} — Diseñado para operar de forma 100% independiente.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {MODULE_DETAILS_MAP[selectedModule].features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-slate-600 leading-normal">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right side interactive capacities */}
                <div className="lg:col-span-5 bg-slate-50/80 rounded-2xl border border-slate-100 p-6 space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-xs tracking-wider uppercase">
                    ¿Qué lo hace único?
                  </h4>
                  <div className="space-y-4 divide-y divide-slate-100">
                    {MODULE_DETAILS_MAP[selectedModule].capabilities.map((cap, i) => (
                      <div key={i} className={`${i > 0 ? 'pt-4' : ''} space-y-1`}>
                        <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          {cap.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 leading-snug pl-3">{cap.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex justify-center">
                    <Link
                      href={PRODUCTS.find(p => p.key === selectedModule)?.href || '#'}
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Ir a la landing del módulo <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </section>

      {/* ═══ BENEFITS BAR ═══ */}
      <section className="py-8 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {[
              { icon: Rocket, text: 'Implementación rápida', sub: 'En semanas, no meses.' },
              { icon: Headphones, text: 'Soporte experto', sub: 'Te acompañamos siempre.' },
              { icon: RefreshCw, text: 'Actualizaciones constantes', sub: 'Siempre al día.' },
              { icon: Lock, text: 'Información segura', sub: 'Tus datos, protegidos.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.text}</p>
                    <p className="text-xs text-slate-400">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="tecnologia" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 sr-fade">
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">¿Por qué LOGISMART?</span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Todo lo que tu operación necesita</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sr-fade">
            {[
              { icon: Brain, title: 'IA Empresarial', desc: 'Análisis predictivo, auditorías automáticas y recomendaciones.', color: 'text-violet-500', bg: 'bg-violet-50' },
              { icon: Activity, title: 'Analytics Real-time', desc: 'Dashboards ejecutivos con KPIs y alertas inteligentes.', color: 'text-blue-500', bg: 'bg-blue-50' },
              { icon: Target, title: 'Compliance', desc: 'ISO 9001, 14001, 45001, 39001, IATF. Auditorías y trazabilidad.', color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { icon: Globe, title: 'Multi-empresa', desc: 'Arquitectura multi-tenant con datos aislados y seguros.', color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-all">
                  <div className={`w-11 h-11 rounded-xl ${feat.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${feat.color}`} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{feat.title}</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ PLANES ═══ */}
      <section id="planes" className="py-20 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12 sr-fade">
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Pricing</span>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Un plan. Todo incluido.</h2>
            <p className="mt-3 text-slate-500">Sin sorpresas. USD 99/mes por módulo con todo lo que necesitás.</p>
          </div>

          <div className="bg-white rounded-3xl border-2 border-orange-200 p-10 shadow-xl shadow-orange-50 relative sr-fade">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full shadow-md">Plan Único</div>
            
            <div className="text-center mb-8">
              <p className="mt-4">
                <span className="text-5xl font-bold text-slate-900">USD 99</span>
                <span className="text-lg text-slate-500"> /mes por módulo</span>
              </p>
              <p className="text-sm text-slate-400 mt-2">Cada módulo se contrata de forma independiente</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {[
                'Usuarios ilimitados',
                'Todas las funcionalidades',
                'IA integrada',
                'Soporte prioritario',
                'Actualizaciones incluidas',
                'API & Integraciones',
                'Multi-empresa',
                'Backups automáticos',
                'Personalización',
                'Sin contratos anuales',
              ].map((f, j) => (
                <div key={j} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" /> {f}
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/login" className="inline-flex px-8 py-3.5 bg-orange-500 text-white rounded-full text-sm font-bold hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-200 transition-all">
                Empezar ahora — 3 días gratis
              </Link>
              <p className="text-xs text-slate-400 mt-3">Sin tarjeta de crédito para la prueba</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACTO ═══ */}
      <section id="contacto" className="py-20 bg-slate-50/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-white rounded-3xl border border-slate-100 p-10 md:p-14 shadow-xl shadow-slate-100/50 sr-fade">
            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Contacto</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Hablemos de tu operación</h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-base">Nuestro equipo te responderá de forma inmediata.</p>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:scale-[1.02] transition-transform">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shadow-sm"><Mail className="w-5 h-5 text-orange-600" /></div>
                <span className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</span>
                <a href="mailto:soporte@logismart.ar" className="mt-2 text-sm font-bold text-slate-800 hover:text-orange-600 transition-colors">soporte@logismart.ar</a>
              </div>
              
              <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:scale-[1.02] transition-transform">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 fill-emerald-600" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.511 1.505 5.399 1.506 5.519 0 10.009-4.486 10.012-10.002.002-2.673-1.033-5.185-2.918-7.072C17.266 1.701 14.755.662 12.01.662 6.491.662 2.001 5.148 1.998 10.663c-.001 1.895.493 3.748 1.433 5.392L2.244 21.04l5.403-1.886z" />
                  </svg>
                </div>
                <span className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wider">WhatsApp</span>
                <a href="https://wa.me/541166169368" target="_blank" rel="noopener noreferrer" className="mt-2 text-sm font-bold text-slate-800 hover:text-emerald-600 transition-colors">+54 1166169368</a>
              </div>
              
              <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:scale-[1.02] transition-transform">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shadow-sm"><MapPin className="w-5 h-5 text-orange-600" /></div>
                <span className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Ubicación</span>
                <span className="mt-2 text-sm font-bold text-slate-800">Buenos Aires, Argentina</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Globo flotante de WhatsApp */}
      <a
        href="https://wa.me/541166169368?text=Hola,%20quisiera%20más%20información%20sobre%20los%20módulos%20de%20Logismart."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[#25D366]/40 transition-all duration-300 flex items-center justify-center group"
        aria-label="Escribinos por WhatsApp"
      >
        <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-md pointer-events-none">
          ¿Cómo podemos ayudarte?
        </span>
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.511 1.505 5.399 1.506 5.519 0 10.009-4.486 10.012-10.002.002-2.673-1.033-5.185-2.918-7.072C17.266 1.701 14.755.662 12.01.662 6.491.662 2.001 5.148 1.998 10.663c-.001 1.895.493 3.748 1.433 5.392L2.244 21.04l5.403-1.886z" />
        </svg>
      </a>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-900 text-white py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold">LOGISMART</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">El ecosistema inteligente para gestionar tu operación empresarial.</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3">Productos</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <Link href="/sgi360-landing" className="block hover:text-white transition-colors">SGI360</Link>
                <Link href="/seh360-landing" className="block hover:text-white transition-colors">SEH360</Link>
                <Link href="/audit360-landing" className="block hover:text-white transition-colors">AUDIT360</Link>
                <Link href="/flota360-landing" className="block hover:text-white transition-colors">FLOTA360</Link>
                <Link href="/siniestros360-landing" className="block hover:text-white transition-colors">SINIESTROS360</Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3">Plataforma</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <a href="#" className="block hover:text-white transition-colors">Documentación</a>
                <a href="#" className="block hover:text-white transition-colors">API</a>
                <a href="#" className="block hover:text-white transition-colors">Status</a>
                <a href="#" className="block hover:text-white transition-colors">Roadmap</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <a href="#" className="block hover:text-white transition-colors">Términos</a>
                <a href="#" className="block hover:text-white transition-colors">Privacidad</a>
                <a href="#" className="block hover:text-white transition-colors">SLA</a>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">© 2024 LOGISMART. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-500 hover:text-white transition-colors"><Linkedin className="w-4 h-4" /></a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
