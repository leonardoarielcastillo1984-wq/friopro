'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/project360/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Error al restablecer contraseña');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="text-center space-y-4">
      <p className="text-red-600 font-medium">Enlace inválido o expirado.</p>
      <Link href="/proyect360-landing/forgot-password" className="text-indigo-600 hover:text-indigo-800 text-sm">Solicitar nuevo enlace</Link>
    </div>
  );

  return done ? (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-gray-700 font-medium">¡Contraseña actualizada!</p>
      <p className="text-gray-500 text-sm">Ya podés iniciar sesión con tu nueva contraseña.</p>
      <Link href="/proyect360-landing" className="inline-block mt-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:opacity-90">
        Iniciar sesión
      </Link>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Mínimo 8 caracteres" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Repetí la contraseña" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
        {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}

export default function Project360ResetPassword() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PROJECT360</h1>
          <p className="text-gray-500 text-sm mt-1">Nueva contraseña</p>
        </div>
        <Suspense fallback={<p className="text-center text-gray-400 text-sm">Cargando...</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
