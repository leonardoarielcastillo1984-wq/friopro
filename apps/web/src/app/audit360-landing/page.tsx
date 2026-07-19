'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck, Zap, ArrowLeft, Eye, EyeOff,
  FileText, BarChart3, Users, Bell,
  Brain, CheckSquare, AlertTriangle, Calendar,
} from 'lucide-react';

const FEATURES = [
  { icon: ClipboardCheck, title: 'Programas de Auditoría', desc: 'Planificación anual de auditorías internas y externas con objetivos, alcance y equipo auditor.' },
  { icon: Brain, title: 'IA para Auditorías', desc: 'Generación automática de checklists por norma, análisis de hallazgos y recomendaciones inteligentes.' },
  { icon: AlertTriangle, title: 'Hallazgos y No Conformidades', desc: 'Registro, clasificación y seguimiento de hallazgos hasta el cierre con evidencias adjuntas.' },
  { icon: CheckSquare, title: 'Acciones Correctivas', desc: 'Planes de acción con responsables, plazos, verificación de eficacia y trazabilidad completa.' },
  { icon: Calendar, title: 'Agenda de Auditorías', desc: 'Calendario de auditorías programadas con notificaciones automáticas a auditores y auditados.' },
  { icon: Users, title: 'Gestión de Auditores', desc: 'Registro de auditores internos y externos con competencias, certificaciones y disponibilidad.' },
  { icon: BarChart3, title: 'Métricas e Indicadores', desc: 'KPIs de eficacia, cumplimiento normativo, evolución de hallazgos y tendencias por área.' },
  { icon: FileText, title: 'Informes Automatizados', desc: 'Generación de informes de auditoría con firma digital, hallazgos y plan de cierre.' },
  { icon: Bell, title: 'Alertas y Vencimientos', desc: 'Notificaciones automáticas por fechas de auditoría, plazos de acciones y re-auditorías.' },
];

export default function Audit360Landing() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');
      const token = data.accessToken ?? data.token;
      if (token) localStorage.setItem('accessToken', token);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
      if (data.activeTenant?.id) localStorage.setItem('tenantId', data.activeTenant.id);
      if (data.csrfToken) localStorage.setItem('csrfToken', data.csrfToken);
      window.location.href = '/audit360';
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <ClipboardCheck className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-violet-700">AUDIT360</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero + Login */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-50/60 to-white"></div>
        <div className="absolute top-20 right-0 w-[520px] h-[520px] bg-gradient-to-br from-violet-100/50 to-purple-100/50 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-full px-4 py-1.5 mb-6">
              <ClipboardCheck className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">AUDIT360 — Auditorías con IA</span>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight">
              Auditorías más inteligentes,<br />
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">hallazgos que se cierran.</span>
            </h1>
            <p className="mt-6 text-xl text-slate-500 leading-relaxed">
              Planificá, ejecutá y cerrá auditorías internas y externas con IA, checklists automáticos y seguimiento de acciones correctivas.
            </p>
          </div>

          {/* Login form */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-violet-600 uppercase tracking-widest">AUDIT360</p>
                <p className="text-sm text-slate-500">Auditorías con Inteligencia Artificial</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">Bienvenido</h2>
            <p className="text-sm text-slate-500 mb-6">Ingresá con tus credenciales LOGISMART</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-60"
              >
                {loading ? 'Ingresando...' : 'Ingresar a AUDIT360'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link href="/sgi360-landing/forgot-password" className="text-xs text-slate-400 hover:text-slate-600">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">Auditorías sin Excel, sin papel</h2>
            <p className="mt-4 text-lg text-slate-500">IA que genera checklists, analiza hallazgos y propone acciones correctivas automáticamente.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:border-violet-100 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-violet-600" />
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
      <section className="py-24 bg-gradient-to-r from-violet-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white">Auditorías que generan valor real</h2>
          <p className="mt-4 text-violet-100 text-lg">Cierre el ciclo auditoría → hallazgo → acción → evidencia con IA integrada.</p>
          <div className="mt-8 flex items-center justify-center">
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <ClipboardCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">AUDIT360</span>
            <span className="text-slate-500 text-xs ml-2">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
