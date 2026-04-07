'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, setCsrfToken } from '@/lib/api';
import { Globe, Building2, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{
        user: { id: string; email: string };
        activeTenant: { id: string; name: string; slug: string };
        csrfToken: string;
      }>('/auth/register', {
        method: 'POST',
        json: { email, password, organizationName },
      });
      setCsrfToken(res.csrfToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Error al registrar');
    } finally {
      setLoading(false);
    }
  }

  const benefits = [
    'Gestión documental integrada',
    'Auditoría con inteligencia artificial',
    'Cumplimiento multinorma (ISO 9001, 14001, 45001, 39001)',
    'Matriz de riesgos 5×5',
    '30 días de prueba gratuita',
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Form */}
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                SGI <span className="text-brand-600">360</span>
              </h1>
              <p className="text-xs text-neutral-500">Sistema de Gestión Integrado</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-neutral-900">Crear cuenta</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Registrá tu organización y empezá a gestionar tu sistema integrado
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">Nombre de la organización</label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Mi Empresa S.A."
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="admin@empresa.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Contraseña</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Confirmar contraseña</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              type="submit"
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel — Benefits */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-brand-600 to-indigo-700 px-12">
        <div className="max-w-md text-white">
          <h2 className="text-3xl font-bold">
            Tu sistema de gestión integrado, en la nube
          </h2>
          <p className="mt-3 text-brand-100">
            Gestioná documentos, auditorías, no conformidades, riesgos e indicadores en una sola plataforma con inteligencia artificial.
          </p>

          <div className="mt-8 space-y-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-300" />
                <span className="text-sm text-brand-50">{b}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl bg-white/10 backdrop-blur-sm p-4">
            <p className="text-sm font-medium text-white">Plan BÁSICO — Gratis 30 días</p>
            <p className="mt-1 text-xs text-brand-200">
              Incluye gestión documental, no conformidades y riesgos. Actualizá a PROFESIONAL o PREMIUM para acceder a IA Auditora y capacitaciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
