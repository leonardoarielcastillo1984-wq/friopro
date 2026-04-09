import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};
  const tab = (sp.tab ?? "active").toLowerCase();

  const from = daysAgo(20);

  const [workOrders, usageEvents] = await Promise.all([
    prisma.workOrder.findMany({
      where: { userId: user.id, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      include: { client: true },
      take: 50,
    }),
    prisma.usageEvent.findMany({
      where: {
        license: { userId: user.id },
        createdAt: { gte: from },
      },
      take: 5000,
    }),
  ]);

  const totals = {
    workOrders: workOrders.length,
    pdfs: usageEvents.filter((e) => e.type === "PDF_GENERATED").length,
    ai: usageEvents.filter((e) => e.type === "AI_CALL").length,
  };

  const statusGroups = {
    active: ["IN_PROGRESS"],
    pending: ["DRAFT"],
    completed: ["COMPLETED"],
    cancelled: ["CANCELLED"],
  } as const;

  const allowedTabs = ["active", "pending", "completed", "cancelled"] as const;
  const activeTab = (allowedTabs.includes(tab as any) ? tab : "active") as
    | "active"
    | "pending"
    | "completed"
    | "cancelled";

  const filtered = workOrders.filter((wo) =>
    (statusGroups as any)[activeTab].includes(wo.status)
  );

  return (
    <MobileShell brand="friopro" title="Estadísticas" userLabel={user.email} active="stats">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Últimos 20 días</div>
            <div className="mt-1 text-xs text-zinc-500">Resumen de actividad</div>
          </div>
          <Link href="/workorders" className="text-sm underline">
            Órdenes
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">OTs</div>
            <div className="mt-1 text-lg font-semibold">{totals.workOrders}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">PDFs</div>
            <div className="mt-1 text-lg font-semibold">{totals.pdfs}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">IA</div>
            <div className="mt-1 text-lg font-semibold">{totals.ai}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Link
            href="/stats?tab=active"
            className={
              "rounded-2xl px-3 py-2 text-center font-medium " +
              (activeTab === "active" ? "bg-emerald-600 text-white" : "bg-zinc-50 text-zinc-700")
            }
          >
            Activas
          </Link>
          <Link
            href="/stats?tab=pending"
            className={
              "rounded-2xl px-3 py-2 text-center font-medium " +
              (activeTab === "pending" ? "bg-emerald-600 text-white" : "bg-zinc-50 text-zinc-700")
            }
          >
            Pendientes
          </Link>
          <Link
            href="/stats?tab=completed"
            className={
              "rounded-2xl px-3 py-2 text-center font-medium " +
              (activeTab === "completed" ? "bg-emerald-600 text-white" : "bg-zinc-50 text-zinc-700")
            }
          >
            Completadas
          </Link>
          <Link
            href="/stats?tab=cancelled"
            className={
              "rounded-2xl px-3 py-2 text-center font-medium " +
              (activeTab === "cancelled" ? "bg-emerald-600 text-white" : "bg-zinc-50 text-zinc-700")
            }
          >
            Canceladas
          </Link>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Sin órdenes en este estado.
          </div>
        ) : (
          filtered.map((wo) => (
            <Link
              key={wo.id}
              href={`/workorders/${wo.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{wo.client.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {wo.serviceType} • {new Date(wo.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                  {wo.status}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
