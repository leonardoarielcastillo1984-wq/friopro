import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
            <p className="text-sm text-zinc-600">FríoPro — Acceso con credenciales</p>
          </header>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}
