import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const client = await prisma.client.findFirst({
    where: { id, userId: user.id },
    include: {
      equipments: { take: 5 },
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { equipment: true },
      },
    },
  });

  if (!client) {
    return (
      <MobileShell brand="friopro" title="Cliente" userLabel={user.email} active="clients">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">Cliente no encontrado</div>
          <Link href="/clients" className="mt-3 inline-block text-sm underline">
            Volver
          </Link>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell brand="friopro" title="Cliente" userLabel={user.email} active="clients">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">{client.name}</div>
        <div className="mt-1 text-xs text-zinc-500">{client.address ?? "—"}</div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">Teléfono</div>
            <div className="mt-1 font-medium text-zinc-900">{client.phone ?? "—"}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">Email</div>
            <div className="mt-1 font-medium text-zinc-900">{client.email ?? "—"}</div>
          </div>
        </div>

        {client.notes ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
            {client.notes}
          </div>
        ) : null}

        <Link href="/clients" className="mt-3 inline-block text-sm underline">
          Volver a clientes
        </Link>
      </div>

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Equipos</div>
          <Link
            href={`/equipments/new?clientId=${client.id}&callbackUrl=${encodeURIComponent(
              `/clients/${client.id}`,
            )}`}
            className="text-sm underline"
          >
            + Agregar
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {client.equipments.length === 0 ? (
            <div className="text-sm text-zinc-600">Sin equipos.</div>
          ) : (
            client.equipments.map((e) => (
              <Link
                key={e.id}
                href={`/equipments/${e.id}`}
                className="block rounded-2xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700"
              >
                <div className="font-medium text-zinc-900">{e.type}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {e.brand ?? ""} {e.model ?? ""}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Órdenes recientes</div>
          <Link href="/workorders" className="text-sm underline">
            Ver todas
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          {client.workOrders.length === 0 ? (
            <div className="text-sm text-zinc-600">Sin órdenes.</div>
          ) : (
            client.workOrders.map((wo) => (
              <Link
                key={wo.id}
                href={`/workorders/${wo.id}`}
                className="block rounded-2xl bg-zinc-50 px-3 py-3 text-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-zinc-900">
                      {wo.serviceType} • {wo.status}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {wo.equipment.type} • {new Date(wo.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{wo.id.slice(0, 6)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </MobileShell>
  );
}
