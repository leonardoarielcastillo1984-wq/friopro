'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Globe, Lock, Eye, EyeOff, CheckCircle2, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        json: { token, newPassword },
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100/50">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-neutral-200/60 bg-white p-8 shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">Enlace inválido</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Este enlace de restablecimiento no es válido. Solicitá uno nuevo.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
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

          {success ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">Contraseña restablecida</h2>
              <p className="mt-2 text-sm text-neutral-500">
                Tu contraseña fue actualizada exitosamente. Ya podés iniciar sesión.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-center text-lg font-semibold text-neutral-900">Nueva contraseña</h2>
              <p className="mt-1 text-center text-sm text-neutral-500">
                Ingresá tu nueva contraseña
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Nueva contraseña</label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-10 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type={showPw ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700">Confirmar contraseña</label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="Repetí la nueva contraseña"
                      minLength={8}
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
                      <Loader2 className="h-4 w-4 animate-spin" /> Restableciendo...
                    </span>
                  ) : (
                    'Restablecer contraseña'
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
