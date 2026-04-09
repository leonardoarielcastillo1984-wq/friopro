import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function WorkOrdersPage() {
  const user = await requireAuth();

  const workOrders = await prisma.workOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      serviceType: true,
      status: true,
      createdAt: true,
      client: { select: { name: true } },
      equipment: { select: { type: true, brand: true, model: true } },
    },
    take: 50,
  });

  return (
    <MobileShell
      brand="friopro"
      title="Órdenes"
      userLabel={user.email}
      active="workorders"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Órdenes</div>
          <div className="text-xs text-zinc-500">Últimas 50</div>
        </div>
        <Link
          href="/workorders/new"
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + Nueva
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {workOrders.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            No hay órdenes aún.
          </div>
        ) : (
          workOrders.map((wo) => (
            <Link
              key={wo.id}
              href={`/workorders/${wo.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {wo.client.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {wo.equipment.type}
                    {wo.equipment.brand ? ` • ${wo.equipment.brand}` : ""}
                    {wo.equipment.model ? ` ${wo.equipment.model}` : ""}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {new Date(wo.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {wo.status}
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                    {wo.serviceType}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
