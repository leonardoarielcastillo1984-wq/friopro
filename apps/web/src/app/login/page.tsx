'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap, Lock, Mail, Clock } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';

  const [email, setEmail] = useState('');

  useEffect(() => {
    const lastEmail = localStorage.getItem('lastLoginEmail');
    if (lastEmail) setEmail(lastEmail);
  }, []);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    const attemptLogin = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          signal: controller.signal,
        });
        return res;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      let res: Response;
      try {
        res = await attemptLogin();
      } catch (networkErr: any) {
        if (networkErr.name === 'AbortError') {
          throw new Error('El servidor tardó demasiado en responder. Intenta nuevamente.');
        }
        // Retry once on network error
        await new Promise(r => setTimeout(r, 1500));
        res = await attemptLogin();
      }

      // Retry once on 502/503 (servidor reiniciando)
      if (res.status === 502 || res.status === 503) {
        await new Promise(r => setTimeout(r, 2000));
        res = await attemptLogin();
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) throw new Error('Email o contraseña incorrectos');
        if (res.status === 429) throw new Error('Demasiados intentos. Esperá un momento e intentá de nuevo.');
        if (res.status === 502 || res.status === 503) throw new Error('El servidor no está disponible. Intenta en unos segundos.');
        throw new Error((data as any)?.error || `Error del servidor (${res.status})`);
      }

      const accessToken = (data as any)?.accessToken ?? (data as any)?.token;
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if ((data as any)?.user) {
        localStorage.setItem('user', JSON.stringify((data as any).user));
        if ((data as any).user.globalRole) {
          localStorage.setItem('globalRole', (data as any).user.globalRole);
        }
      }
      localStorage.setItem('lastLoginEmail', email.trim());
      if ((data as any)?.activeTenant?.id) localStorage.setItem('tenantId', (data as any).activeTenant.id);
      if ((data as any)?.csrfToken) localStorage.setItem('csrfToken', (data as any).csrfToken);

      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e.message || 'Error inesperado. Por favor intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 mb-4">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SGI 360</h1>
          <p className="text-slate-400">Sistema de Gestión Integrado</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Iniciar sesión
          </h2>

          {sessionExpired && !error && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-300 text-sm">Tu sesión expiró. Ingresá nuevamente para continuar.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5" onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!loading) {
                handleLogin();
              }
            }
          }}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-orange-500" />
                  Email
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-slate-500"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-orange-500" />
                  Contraseña
                </span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-slate-500"
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 px-4 rounded-lg transition-all font-medium shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-slate-400 hover:text-orange-500 transition-colors text-sm">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
