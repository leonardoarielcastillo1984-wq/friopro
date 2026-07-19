'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban, Zap, ArrowLeft, Eye, EyeOff,
  LayoutDashboard, Users, BarChart3, Bell,
  Calendar, CheckSquare, GitBranch, Clock,
} from 'lucide-react';

const FEATURES = [
  { icon: LayoutDashboard, title: 'Dashboard de Proyectos', desc: 'Vista ejecutiva de todos los proyectos activos, KPIs de avance, presupuesto y riesgo.' },
  { icon: FolderKanban, title: 'Tablero Kanban', desc: 'Gestión visual de tareas por estado con drag & drop, prioridades y responsables.' },
  { icon: Users, title: 'Equipos y Recursos', desc: 'Asignación de recursos humanos y materiales con control de capacidad y disponibilidad.' },
  { icon: Calendar, title: 'Cronograma y Hitos', desc: 'Diagrama Gantt interactivo con hitos, dependencias y alertas de desvíos.' },
  { icon: BarChart3, title: 'Seguimiento de Avance', desc: 'Métricas de progreso vs. planificación, valor ganado y predicción de fechas de cierre.' },
  { icon: GitBranch, title: 'Gestión de Cambios', desc: 'Solicitudes de cambio con impacto en alcance, tiempo y costo con flujo de aprobación.' },
  { icon: Clock, title: 'Registro de Horas', desc: 'Imputación de horas por proyecto, tarea y recurso con reportes de productividad.' },
  { icon: Bell, title: 'Alertas y Notificaciones', desc: 'Avisos automáticos por vencimiento de hitos, desvíos de presupuesto y tareas bloqueadas.' },
  { icon: CheckSquare, title: 'Cierre y Lecciones', desc: 'Proceso de cierre formal con checklist, métricas finales y registro de lecciones aprendidas.' },
];

export default function Proyect360Landing() {
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
      window.location.href = '/project360';
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
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <FolderKanban className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-blue-700">PROYECT360</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero + Login */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 to-white"></div>
        <div className="absolute top-20 right-0 w-[520px] h-[520px] bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6">
              <FolderKanban className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">PROYECT360 — Gestión de Proyectos</span>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 leading-tight">
              Proyectos que llegan<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">a tiempo y en presupuesto.</span>
            </h1>
            <p className="mt-6 text-xl text-slate-500 leading-relaxed">
              Gestioná proyectos, equipos, hitos y recursos con Kanban, Gantt y reportes en tiempo real impulsados por IA.
            </p>
          </div>

          {/* Login form */}
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">PROYECT360</p>
                <p className="text-sm text-slate-500">Gestión de Proyectos</p>
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60"
              >
                {loading ? 'Ingresando...' : 'Ingresar a PROYECT360'}
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
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="mt-3 text-4xl font-bold text-slate-900">Todo tu PMO en un solo lugar</h2>
            <p className="mt-4 text-lg text-slate-500">Desde la iniciación hasta el cierre, con visibilidad total para el equipo y la dirección.</p>
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
      <section className="py-24 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white">Proyectos bajo control, siempre</h2>
          <p className="mt-4 text-blue-100 text-lg">Visibilidad total, equipos alineados y entregas a tiempo con PROYECT360.</p>
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <FolderKanban className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">PROYECT360</span>
            <span className="text-slate-500 text-xs ml-2">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
