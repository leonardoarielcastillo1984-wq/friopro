import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

  const clients = await prisma.client.findMany({
    where: {
      userId: user.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      _count: {
        select: { equipments: true, workOrders: true },
      },
    },
    take: 100,
  });

  return (
    <MobileShell
      brand="friopro"
      title="Clientes"
      userLabel={user.email}
      active="clients"
    >
      <div className="mt-1 flex gap-3">
        <form action="/clients" method="get" className="flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar clientes..."
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
          />
        </form>
        <Link
          href="/clients/new"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + Agregar
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {clients.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Sin clientes.
          </div>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{c.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {c.address ? c.address : "—"}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                      Equipos: {c._count.equipments}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                      OTs: {c._count.workOrders}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs text-zinc-500">
                  <div>{c.phone ?? ""}</div>
                  <div>{c.email ?? ""}</div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
