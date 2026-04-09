import Link from "next/link";

import { getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";

function formatDate(d: Date) {
  return d.toLocaleDateString();
}

function typeLabel(type: string, customType?: string | null) {
  if (type === "SPLIT_INVERTER") return "Aire split (inverter)";
  if (type === "SPLIT_ON_OFF") return "Aire split (on/off)";
  if (type === "VENTANA") return "Aire ventana";
  if (type === "HELADERA") return "Heladera";
  if (type === "FREEZER") return "Congelador";
  if (type === "CAMARA") return "Cámara";
  if (type === "OTRO") return customType?.trim() ? customType : "Otro";
  return type;
}

export default async function PublicEquipmentPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const equipment = await prisma.equipment.findFirst({
    where: { publicId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      maintenancePlan: true,
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          status: true,
          serviceType: true,
        },
      },
    },
  });

  if (!equipment) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-950">
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold">Equipo no encontrado</div>
            <div className="mt-2 text-sm text-zinc-600">
              Este QR no corresponde a ningún equipo.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const access = await getAccessState(equipment.user.id);
  const planCode = access.mode === "FULL" ? access.planCode : "FREE";

  const canShowBasic = access.mode === "FULL" && access.features.qrEnabled === true;
  const canShowHistory = planCode === "PRO_PLUS";

  const last = equipment.workOrders[0] ?? null;

  if (!canShowBasic) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-950">
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold">QR no disponible</div>
            <div className="mt-2 text-sm text-zinc-600">
              Este QR público requiere plan PRO o PRO+.
            </div>
            <div className="mt-4 text-sm text-zinc-600">
              Contactá a tu técnico para más información.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const equipmentTitle = `${typeLabel(equipment.type as any, (equipment as any).customType)}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <div className="text-base font-semibold tracking-tight">friopro</div>
            <div className="text-xs text-zinc-500">Equipo (QR público)</div>
          </div>
          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {planCode === "PRO_PLUS" ? "PRO+" : "PRO"}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">{equipmentTitle}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {equipment.brand ? `Marca: ${equipment.brand}` : ""}
            {equipment.model ? ` ${equipment.model}` : ""}
          </div>

          <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="text-xs text-zinc-500">Ubicación</div>
            <div className="mt-1 font-medium text-zinc-900">{equipment.locationAddress ?? "—"}</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-zinc-50 px-3 py-3">
              <div className="text-xs text-zinc-500">Última intervención</div>
              <div className="mt-1 font-medium text-zinc-900">
                {last ? formatDate(last.createdAt) : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-3 py-3">
              <div className="text-xs text-zinc-500">Próximo mantenimiento</div>
              <div className="mt-1 font-medium text-zinc-900">
                {equipment.maintenancePlan?.nextDate
                  ? formatDate(equipment.maintenancePlan.nextDate)
                  : "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm">
            <div className="text-xs text-zinc-500">QR</div>
            <div className="mt-1 font-mono text-sm font-semibold text-zinc-900">{equipment.publicId}</div>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Recordatorio sugerido por el técnico. El cliente no necesita cuenta.
          </div>
        </div>

        {canShowHistory ? (
          <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Historial (resumen)</div>
            <div className="mt-3 space-y-2">
              {equipment.workOrders.length === 0 ? (
                <div className="text-sm text-zinc-600">Sin órdenes registradas.</div>
              ) : (
                equipment.workOrders.slice(0, 10).map((wo) => (
                  <div key={wo.id} className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-zinc-900">
                          {wo.serviceType} • {wo.status}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{formatDate(wo.createdAt)}</div>
                      </div>
                      <div className="text-xs text-zinc-500">{wo.id.slice(0, 6)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Historial completo disponible en PRO+.
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm underline">
            Ir a FríoPro
          </Link>
        </div>
      </main>
    </div>
  );
}
