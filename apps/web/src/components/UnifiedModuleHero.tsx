import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Loader2, Send, CheckCircle2, Eye, EyeOff, Sparkles, Building2, Mail, Phone, User, Lock, AlertCircle } from 'lucide-react';

interface UnifiedModuleHeroProps {
  moduleKey: string;
  title: string;
  subtitle: string;
  description: string;
  badges: string[];
  colorFrom: string; // e.g., 'from-orange-500'
  colorTo: string;   // e.g., 'to-amber-500'
  icon: any;         // Lucide Icon component
  loginEndpoint: string;
  destination: string;
  forgotPasswordHref?: string;
  signupEndpoint?: string;
}

export default function UnifiedModuleHero({
  moduleKey,
  title,
  subtitle,
  description,
  badges,
  colorFrom,
  colorTo,
  icon: Icon,
  loginEndpoint,
  destination,
  forgotPasswordHref = '/forgot-password',
  signupEndpoint
}: UnifiedModuleHeroProps) {
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register request states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', company: '', message: '', password: '' });
  const [submittingRegister, setSubmittingRegister] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Dynamic Theme Colors for Login Form to match each module
  const getThemeColor = () => {
    switch (moduleKey) {
      case 'sgi360': return 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500/20';
      case 'seh360': return 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20';
      case 'audit360': return 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-500/20';
      case 'flota360': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20';
      case 'siniestros360': return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/20';
      default: return 'bg-slate-900 hover:bg-slate-800';
    }
  };

  const getPassBgColor = () => {
    switch (moduleKey) {
      case 'seh360': return 'bg-emerald-50/30 focus:bg-white';
      case 'sgi360': return 'bg-orange-50/30 focus:bg-white';
      case 'audit360': return 'bg-violet-50/30 focus:bg-white';
      default: return 'bg-slate-50/50 focus:bg-white';
    }
  };

  // Handle integrated login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');

      // Save credentials & redirect
      if (moduleKey === 'seh360') {
        localStorage.setItem('seh360_token', data.token);
        localStorage.setItem('seh360_user', JSON.stringify(data.user));
      } else if (moduleKey === 'flota360') {
        if (data.token) {
          localStorage.setItem('flotaToken', data.token);
          localStorage.setItem('accessToken', data.token);
        }
      } else if (moduleKey === 'siniestros360') {
        if (data.token) {
          localStorage.setItem('s360Token', data.token);
          if (data.user) localStorage.setItem('s360User', JSON.stringify(data.user));
          document.cookie = 's360Token=' + data.token + '; path=/; max-age=' + (60*60*24*7);
        }
      } else if (moduleKey === 'audit360') {
        if (data.token) {
          localStorage.setItem('audit360Token', data.token);
          if (data.user) localStorage.setItem('audit360User', JSON.stringify(data.user));
          document.cookie = 'audit360_token=' + data.token + '; path=/; SameSite=Lax';
        }
      } else if (moduleKey === 'proyect360' || moduleKey === 'project360') {
        if (data.token) {
          localStorage.setItem('project360Token', data.token);
          localStorage.setItem('project360Session', JSON.stringify(data));
        }
      } else {
        const accessToken = data.accessToken ?? data.token ?? data.jwt;
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        if (data.activeTenant?.id) localStorage.setItem('tenantId', data.activeTenant.id);
        if (data.csrfToken) localStorage.setItem('csrfToken', data.csrfToken);
      }

      window.location.href = destination;
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoggingIn(false);
    }
  };

  // Handle register: self-service signup (if signupEndpoint) or lead request
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRegister(true);
    setRegisterError('');
    try {
      if (signupEndpoint) {
        // Self-service signup: crea cuenta + trial, auto-login, redirect
        const res = await fetch(signupEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            companyName: registerForm.company,
            name: registerForm.name,
            email: registerForm.email,
            phone: registerForm.phone || undefined,
            password: registerForm.password,
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRegisterError(data.error || 'No se pudo crear la cuenta. Intentá nuevamente.');
          return;
        }
        // Guardar token segun modulo y redirigir
        if (data.token) {
          if (moduleKey === 'audit360') {
            localStorage.setItem('audit360Token', data.token);
            if (data.user) localStorage.setItem('audit360User', JSON.stringify(data.user));
            document.cookie = 'audit360_token=' + data.token + '; path=/; SameSite=Lax';
          } else if (moduleKey === 'seh360') {
            localStorage.setItem('seh360_token', data.token);
            if (data.user) localStorage.setItem('seh360_user', JSON.stringify(data.user));
          } else if (moduleKey === 'proyect360' || moduleKey === 'project360') {
            localStorage.setItem('project360Token', data.token);
            localStorage.setItem('project360Session', JSON.stringify(data));
          } else if (moduleKey === 'flota360') {
            localStorage.setItem('flotaToken', data.token);
            localStorage.setItem('accessToken', data.token);
          } else if (moduleKey === 'siniestros360') {
            localStorage.setItem('s360Token', data.token);
            if (data.user) localStorage.setItem('s360User', JSON.stringify(data.user));
            document.cookie = 's360Token=' + data.token + '; path=/; max-age=' + (60*60*24*7);
          } else {
            localStorage.setItem('accessToken', data.token);
          }
        }
        setRegisterSuccess(true);
        setTimeout(() => { window.location.href = destination; }, 1800);
        return;
      }
      // Lead request (comportamiento por defecto)
      const res = await fetch('/api/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registerForm, module: moduleKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterError(data.error || 'Ocurrió un error. Intentá nuevamente.');
        return;
      }
      // Mostrar confirmación; el usuario cierra manualmente con "Aceptar"
      setRegisterSuccess(true);
    } catch (err) {
      setRegisterError('Error de conexión. Intentá nuevamente.');
    } finally {
      setSubmittingRegister(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Left Side: Module Hero info */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full">
            <Icon className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-semibold text-slate-700">{subtitle}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1] break-words">
            {title.split(' ').map((word, i) => {
              if (word.toLowerCase().includes('lugar') || word.toLowerCase().includes('seguridad') || word.toLowerCase().includes('auditorías') || word.toLowerCase().includes('flota') || word.toLowerCase().includes('siniestros') || word.toLowerCase().includes('proyectos')) {
                return <span key={i} className={`bg-gradient-to-r ${colorFrom} ${colorTo} bg-clip-text text-transparent mr-2 inline-block`}>{word}</span>;
              }
              return <span key={i} className="mr-2 inline-block">{word}</span>;
            })}
          </h1>

          <p className="text-base text-slate-500 leading-relaxed max-w-xl">
            {description}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {badges.map((badge) => (
              <span key={badge} className="px-3 py-1.5 bg-slate-50 border border-slate-100 text-slate-600 text-xs font-semibold rounded-lg">{badge}</span>
            ))}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setShowRegisterModal(true)}
              className={`px-8 py-4 bg-gradient-to-r ${colorFrom} ${colorTo} text-white rounded-2xl text-sm font-bold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
            >
              Empezar Ahora <ArrowRight className="w-4 h-4 animate-pulse" />
            </button>
            <a href="#features" className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> Ver Funcionalidades
            </a>
          </div>
        </div>

        {/* Right Side: Replicated aesthetic Login Form Card */}
        <div className="lg:col-span-5 relative">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl shadow-slate-100/50 p-10 relative">
            <div className="mb-6 text-left">
              <h3 className="text-xl font-bold text-gray-900">Iniciar sesión</h3>
              <p className="text-xs text-gray-400 mt-1">Accedé a tu espacio de trabajo</p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-ping"></span>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-gray-50 border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 transition-all ${getPassBgColor()}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-right pt-0.5">
                <Link href={forgotPasswordHref} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className={`w-full py-2.5 ${getThemeColor()} focus:outline-none focus:ring-4 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 mt-4`}
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </button>

              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <Link
                  href="/"
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium inline-flex items-center gap-1.5 mx-auto"
                >
                  ← Volver a la Suite LOGISMART
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL: Solicitud de Registro de Nuevos Clientes ("Empezar Ahora") */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-orange-500 to-amber-500"></div>
            
            {registerSuccess ? (
              signupEndpoint ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">¡Cuenta creada!</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Tu prueba gratuita de <strong>7 días</strong> está activa. Te estamos redirigiendo...
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-extrabold text-slate-900">¡Registro exitoso!</h3>
                    <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                      Tu solicitud de alta se registró correctamente.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-left max-w-sm mx-auto space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                      <span>En breve recibirás un <strong>correo electrónico</strong> con tus <strong>datos de acceso</strong> al sistema.</span>
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>Si no lo encontrás en tu bandeja de entrada, revisá la carpeta de <strong>correo no deseado (Spam)</strong>.</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRegisterModal(false);
                      setRegisterSuccess(false);
                      setRegisterForm({ name: '', email: '', phone: '', company: '', message: '', password: '' });
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-10 py-2.5 text-sm font-semibold text-white shadow-sm transition-all"
                  >
                    Aceptar
                  </button>
                </div>
              )
            ) : (
              <>
                {registerError && (
                  <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span>{registerError}</span>
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
                      {signupEndpoint ? 'Crear tu cuenta gratis' : 'Solicitar Alta de Cliente'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{signupEndpoint ? 'Empezá tu prueba gratis de 7 días' : `Registrá tus datos para habilitar ${moduleKey.toUpperCase()}`}</p>
                  </div>
                  <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nombre Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input required type="text" placeholder="Juan Pérez" value={registerForm.name} onChange={e => setRegisterForm({...registerForm, name: e.target.value})} className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 outline-none focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Corporativo</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input required type="email" placeholder="juan@empresa.com" value={registerForm.email} onChange={e => setRegisterForm({...registerForm, email: e.target.value})} className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 outline-none focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Teléfono de Contacto</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input required type="tel" placeholder="+54 9 11 2345-6789" value={registerForm.phone} onChange={e => setRegisterForm({...registerForm, phone: e.target.value})} className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 outline-none focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Empresa / Organización</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input required type="text" placeholder="Nombre de tu Organización" value={registerForm.company} onChange={e => setRegisterForm({...registerForm, company: e.target.value})} className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 outline-none focus:bg-white" />
                    </div>
                  </div>

                  {signupEndpoint && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input required minLength={8} type="password" placeholder="Mínimo 8 caracteres" value={registerForm.password} onChange={e => setRegisterForm({...registerForm, password: e.target.value})} className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 outline-none focus:bg-white" />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => setShowRegisterModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                    <button type="submit" disabled={submittingRegister} className="rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2 font-semibold text-white shadow-sm flex items-center gap-1.5">
                      {submittingRegister ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {signupEndpoint ? 'Crear cuenta' : 'Enviar Solicitud'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
