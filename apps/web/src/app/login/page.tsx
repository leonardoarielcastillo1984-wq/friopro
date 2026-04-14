'use client';

import { useState } from 'react';
import { Zap, Lock, Mail } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@sgi360.com');
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

    try {
      // Forzar API Fixed v2 para evitar problemas de configuración
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const loginUrl = "/api/auth/login";
      console.log('=== LOGIN DEBUG ===');
      console.log('Login attempt to:', loginUrl);
      console.log('Credentials:', { email, password: '***' });
      console.log('Timestamp:', new Date().toISOString());
      
      // Agregar timestamp para evitar caché
      const cacheBuster = `?t=${Date.now()}`;
      const res = await fetch(`${loginUrl}${cacheBuster}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));

      const data = await res.json().catch(() => null);
      console.log('Response data:', data);
      console.log('=== END LOGIN DEBUG ===');

      if (!res.ok) {
        throw new Error((data as any)?.error || `HTTP ${res.status}`);
      }

      const accessToken = (data as any)?.accessToken ?? (data as any)?.token;
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if ((data as any)?.user) {
        localStorage.setItem('user', JSON.stringify((data as any).user));
        // Guardar globalRole específicamente
        if ((data as any).user.globalRole) {
          localStorage.setItem('globalRole', (data as any).user.globalRole);
          console.log('Login: GlobalRole guardado:', (data as any).user.globalRole);
        } else {
          console.log('Login: user.globalRole no encontrado en:', (data as any).user);
        }
      }
      if ((data as any)?.activeTenant?.id) localStorage.setItem('tenantId', (data as any).activeTenant.id);
      if ((data as any)?.csrfToken) localStorage.setItem('csrfToken', (data as any).csrfToken);
      
      // Debug final del localStorage
      console.log('Login: Estado final del localStorage:');
      console.log('- globalRole:', localStorage.getItem('globalRole'));
      console.log('- user:', localStorage.getItem('user'));
      console.log('- accessToken:', localStorage.getItem('accessToken') ? '***' : null);

      window.location.href = '/dashboard';
    } catch (e: any) {
      console.error('Login error:', e);
      setError('Credenciales inválidas o error de servidor. Por favor intenta nuevamente.');
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
