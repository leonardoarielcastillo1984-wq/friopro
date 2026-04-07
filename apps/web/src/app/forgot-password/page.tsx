'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Globe, Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        json: { email },
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100/50">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/60 bg-white p-8 shadow-lg">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center gap-3">
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

          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Revisá tu email</h2>
              <p className="mt-2 text-sm text-neutral-500">
                Si existe una cuenta con <span className="font-medium text-neutral-700">{email}</span>,
                recibirás un enlace para restablecer tu contraseña.
              </p>
              <p className="mt-1 text-xs text-neutral-400">El enlace expira en 30 minutos.</p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Volver al login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-center text-lg font-semibold text-neutral-900">Recuperar contraseña</h2>
              <p className="mt-1 text-center text-sm text-neutral-500">
                Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Email</label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="usuario@empresa.com"
                      autoComplete="email"
                      required
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
                  className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                  type="submit"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                    </span>
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
