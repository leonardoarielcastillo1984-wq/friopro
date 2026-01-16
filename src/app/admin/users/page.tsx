import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? "").trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
    },
    take: 100,
  });

  async function setStatus(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!id) return;

    if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "DELETED") {
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { status: status as any },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-zinc-600">Listar, buscar y administrar estado.</p>

        <form className="mt-4 flex gap-2" action="/admin/users" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          />
          <button className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Buscar
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último login</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{u.name}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={setStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="ACTIVE" />
                        <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50">
                          Activar
                        </button>
                      </form>
                      <form action={setStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="SUSPENDED" />
                        <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50">
                          Suspender
                        </button>
                      </form>
                      <form action={setStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="DELETED" />
                        <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100">
                          Eliminar
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
