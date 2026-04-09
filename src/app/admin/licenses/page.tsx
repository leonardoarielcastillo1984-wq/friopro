import { prisma } from "@/lib/prisma";

export default async function AdminLicensesPage() {
  const [users, plans, licenses] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TECHNICIAN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, status: true },
      take: 200,
    }),
    prisma.plan.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.license.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        plan: { select: { id: true, code: true, name: true } },
      },
      take: 200,
    }),
  ]);

  async function createLicense(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const planId = String(formData.get("planId") ?? "");
    const startsAt = String(formData.get("startsAt") ?? "");
    const expiresAt = String(formData.get("expiresAt") ?? "");
    const status = String(formData.get("status") ?? "ACTIVE");

    if (!userId || !planId || !startsAt || !expiresAt) return;

    if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "EXPIRED") return;

    await prisma.license.create({
      data: {
        userId,
        planId,
        startsAt: new Date(startsAt),
        expiresAt: new Date(expiresAt),
        active: status === "ACTIVE",
        status: status as any,
      },
    });
  }

  async function updateLicense(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!id) return;

    if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "EXPIRED") return;

    await prisma.license.update({
      where: { id },
      data: {
        status: status as any,
        active: status === "ACTIVE",
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Licencias</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Asignar plan a usuarios y gestionar estado/vencimiento.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Crear licencia</h2>

        <form action={createLicense} className="mt-4 grid gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Usuario</label>
              <select
                name="userId"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                required
              >
                <option value="">Seleccionar...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) [{u.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Plan</label>
              <select
                name="planId"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                required
              >
                <option value="">Seleccionar...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Inicio</label>
              <input
                name="startsAt"
                type="date"
                required
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Vencimiento</label>
              <input
                name="expiresAt"
                type="date"
                required
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Estado</label>
              <select
                name="status"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                defaultValue="ACTIVE"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
              Crear
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{l.user.name}</div>
                    <div className="text-xs text-zinc-500">{l.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {l.plan.code} — {l.plan.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {new Date(l.startsAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {new Date(l.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateLicense}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="ACTIVE" />
                        <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50">
                          Activar
                        </button>
                      </form>
                      <form action={updateLicense}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="SUSPENDED" />
                        <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50">
                          Suspender
                        </button>
                      </form>
                      <form action={updateLicense}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="EXPIRED" />
                        <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50">
                          Marcar vencida
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
