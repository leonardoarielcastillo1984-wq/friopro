import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const user = await requireAuth();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const [userCount, activeUserCount, planCount, activeLicenses] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.plan.count(),
      prisma.license.count({ where: { status: "ACTIVE", active: true } }),
    ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Acceso: {user.email} ({user.role})
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-zinc-500">Usuarios</div>
          <div className="mt-2 text-2xl font-semibold">{userCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Activos: {activeUserCount}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-zinc-500">Planes</div>
          <div className="mt-2 text-2xl font-semibold">{planCount}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Licencias activas: {activeLicenses}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Accesos rápidos</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="/admin/users"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50"
          >
            Gestionar usuarios
          </a>
          <a
            href="/admin/plans"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50"
          >
            Gestionar planes
          </a>
          <a
            href="/admin/licenses"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50"
          >
            Gestionar licencias
          </a>
          <a
            href="/admin/usage"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50"
          >
            Ver uso
          </a>
        </div>
      </div>
    </div>
  );
}
