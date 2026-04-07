'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@sgi360.com');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      console.log('🔵 Iniciando login...');
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('📡 Status:', res.status);
      const data = await res.json();
      console.log('📋 Data:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.token) {
        console.log('✅ Login exitoso');
        // Guardar token
        localStorage.setItem('accessToken', data.token);
        document.cookie = `access_token=${data.token}; path=/; SameSite=Lax`;
        
        // Redirección simple
        window.location.href = '/dashboard';
        return;
      }

      throw new Error('No token received');
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100/50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/60 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-center text-neutral-900">SGI 360</h1>
          <p className="mt-2 text-center text-neutral-600">
            Ingresá tus credenciales para acceder
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Password</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              type="submit"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-500">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
