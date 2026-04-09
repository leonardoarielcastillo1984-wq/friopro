"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = (data as any)?.error ?? "ERROR";
        if (code === "EMAIL_IN_USE") {
          setError("Ese email ya está registrado.");
        } else if (code === "INVALID_INPUT") {
          setError("Revisá los datos (nombre, email y contraseña).");
        } else {
          setError("No se pudo registrar. Intentá de nuevo.");
        }
        return;
      }

      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (login?.error) {
        setError("Usuario creado, pero no se pudo iniciar sesión automáticamente.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No se pudo registrar. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          placeholder="Tu nombre"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          placeholder="tu@email.com"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Contraseña</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          placeholder="Mínimo 6 caracteres"
          required
        />
      </div>

      <button
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creando..." : "Crear cuenta"}
      </button>
    </form>
  );
}
