'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Project360ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/project360/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al procesar la solicitud');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PROJECT360</h1>
          <p className="text-gray-500 text-sm mt-1">Recuperar contraseña</p>
        </div>
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">¡Revisá tu correo!</p>
            <p className="text-gray-500 text-sm">Si tu email está registrado en PROJECT360, recibirás las instrucciones en unos minutos.</p>
            <Link href="/proyect360-landing" className="inline-block mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-600 text-sm text-center">Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="tu@empresa.com"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
            <div className="text-center">
              <Link href="/proyect360-landing" className="text-indigo-600 hover:text-indigo-800 text-sm">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
