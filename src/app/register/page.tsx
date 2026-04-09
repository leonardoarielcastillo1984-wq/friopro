import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { RegisterForm } from "@/app/register/register-form";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Registrarse</h1>
            <p className="text-sm text-zinc-600">FríoPro — Crear cuenta (plan FREE)</p>
          </header>

          <RegisterForm />

          <div className="text-center text-sm text-zinc-600">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-medium underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
