"use client";
import { useState } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function SGI360ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest">SGI360</p>
              <p className="text-sm text-slate-500">Sistema de Gestión Integrado</p>
            </div>
          </div>

          {sent ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-slate-900 mb-2">Revisá tu correo</h2>
              <p className="text-slate-500 text-sm mb-4">
                Si el correo existe en el sistema, te enviamos las instrucciones para restablecer tu contraseña.
              </p>
              <Link href="/sgi360-landing" className="text-green-600 hover:text-green-700 text-sm font-semibold inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Recuperar contraseña</h2>
              <p className="text-slate-500 text-sm mb-6">
                Ingresá tu email y te enviaremos las instrucciones para restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:from-green-700 hover:to-emerald-600 transition-all disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Enviar instrucciones"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/sgi360-landing" className="text-slate-400 hover:text-slate-600 text-xs flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" /> Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
