'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Zap, ArrowLeft, Eye, EyeOff,
  FileText, AlertTriangle, BarChart3, Users,
  ClipboardList, Globe, Bell, CheckSquare,
} from 'lucide-react';

const FEATURES = [
  { icon: ShieldCheck, title: 'Gestión Legal y Normativa', desc: 'Control de requisitos legales aplicables, actualizaciones y cumplimiento en seguridad y ambiente.' },
  { icon: AlertTriangle, title: 'IPERC & Riesgos', desc: 'Identificación de peligros, evaluación de riesgos y controles operacionales por puesto y área.' },
  { icon: ClipboardList, title: 'Inspecciones y Auditorías', desc: 'Programación, ejecución y seguimiento de inspecciones de campo con evidencia fotográfica.' },
  { icon: BarChart3, title: 'Indicadores SEH', desc: 'KPIs de accidentabilidad, frecuencia y gravedad con tendencias y comparativas sectoriales.' },
  { icon: FileText, title: 'Accidentes e Incidentes', desc: 'Registro, investigación de causas raíz y seguimiento de acciones correctivas hasta cierre.' },
  { icon: Users, title: 'Capacitación y Competencias', desc: 'Plan anual de capacitación SEH, asistencia, evaluaciones y certificados por empleado.' },
  { icon: Globe, title: 'Gestión Ambiental', desc: 'Aspectos e impactos ambientales, objetivos ISO 14001 y monitoreo de indicadores ambientales.' },
  { icon: Bell, title: 'Alertas y Notificaciones', desc: 'Alertas automáticas por vencimiento legal, hallazgos críticos y acciones pendientes.' },
  { icon: CheckSquare, title: 'Simulacros y Emergencias', desc: 'Planificación de simulacros, evaluación de respuesta y planes de contingencia actualizados.' },
];

export default function SEH360Landing() {
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
      window.location.href = '/dashboard';
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-emerald-700">SEH360</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero + Login */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-white"></div>
        <div className="absolute top-20 right-0 w-[520px] h-[520px] bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 mb-6">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">SEH360 — Seguridad, Ambiente & Salud</span>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight">
              La seguridad no espera.<br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Controlá todo en tiempo real.</span>
            </h1>
            <p className="mt-6 text-xl text-slate-500 leading-relaxed">
              Centralizá gestión legal, riesgos, accidentes, inspecciones y capacitación SEH en una sola plataforma con IA integrada.
            </p>
          </div>

          {/* Login form */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">SEH360</p>
                <p className="text-sm text-slate-500">Seguridad, Ambiente & Salud</p>
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-600 transition-all disabled:opacity-60"
              >
                {loading ? 'Ingresando...' : 'Ingresar a SEH360'}
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
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">Todo el SEH en un solo panel</h2>
            <p className="mt-4 text-lg text-slate-500">ISO 45001, ISO 14001 y cumplimiento legal centralizado con IA y alertas en tiempo real.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:border-emerald-100 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-emerald-600" />
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
      <section className="py-24 bg-gradient-to-r from-emerald-600 to-teal-500">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white">Seguridad, ambiente y salud bajo control</h2>
          <p className="mt-4 text-emerald-100 text-lg">Cumplí ISO 45001 e ISO 14001 con trazabilidad total y notificaciones automáticas.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">SEH360</span>
            <span className="text-slate-500 text-xs ml-2">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
