import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";
import { getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";
import { MaintenanceForm } from "@/app/equipments/[id]/maintenance-form";

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

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const equipment = await prisma.equipment.findFirst({
    where: { id, userId: user.id },
    include: {
      client: true,
      maintenancePlan: true,
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { client: true },
      },
    },
  });

  if (!equipment) {
    return (
      <MobileShell brand="friopro" title="Equipo" userLabel={user.email} active="clients">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">Equipo no encontrado</div>
          <Link href="/equipments" className="mt-3 inline-block text-sm underline">
            Volver
          </Link>
        </div>
      </MobileShell>
    );
  }

  const access = await getAccessState(user.id);
  const canManageMaintenance = access.mode === "FULL" && access.planCode === "PRO_PLUS";

  async function saveMaintenance(formData: FormData) {
    "use server";
    const user = await requireAuth();
    const access = await getAccessState(user.id);
    if (access.mode !== "FULL" || access.planCode !== "PRO_PLUS") {
      redirect(`/equipments/${id}?error=Disponible%20en%20PRO_PLUS`);
    }

    const nextDateStr = String(formData.get("nextDate") ?? "").trim();
    const daysBeforeStr = String(formData.get("daysBefore") ?? "7").trim();
    const notifyEmail = formData.get("notifyEmail") === "on";
    const notifyMessage = formData.get("notifyMessage") === "on";

    if (!nextDateStr) {
      redirect(`/equipments/${id}?error=Eleg%C3%AD%20una%20fecha`);
    }

    const daysBefore = Math.max(1, Math.min(60, Number(daysBeforeStr) || 7));
    const nextDate = new Date(`${nextDateStr}T00:00:00`);

    const owned = await prisma.equipment.findFirst({
      where: { id, userId: user.id },
      include: { client: true },
    });

    if (!owned) redirect(`/equipments/${id}?error=Equipo%20inv%C3%A1lido`);

    if (notifyEmail && !owned.client?.email) {
      redirect(`/equipments/${id}?error=Ingres%C3%A1%20email%20del%20cliente`);
    }

    if (notifyMessage && !owned.client?.phone) {
      redirect(`/equipments/${id}?error=Ingres%C3%A1%20tel%C3%A9fono%20del%20cliente`);
    }

    await prisma.maintenancePlan.upsert({
      where: { equipmentId: id },
      update: {
        nextDate,
        daysBefore,
        notifyEmail,
        notifyMessage,
        lastNotifiedAt: null,
      },
      create: {
        equipmentId: id,
        nextDate,
        daysBefore,
        notifyEmail,
        notifyMessage,
      },
    });

    redirect(`/equipments/${id}?ok=Mantenimiento%20actualizado`);
  }

  return (
    <MobileShell brand="friopro" title="Equipo" userLabel={user.email} active="clients">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">
          {typeLabel(equipment.type as any, (equipment as any).customType)}
          {equipment.brand ? ` • ${equipment.brand}` : ""}
          {equipment.model ? ` ${equipment.model}` : ""}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {equipment.client?.name ? `Cliente: ${equipment.client.name}` : "Sin cliente"}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">Serie</div>
            <div className="mt-1 font-medium text-zinc-900">{equipment.serial ?? "—"}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">QR (publicId)</div>
            <div className="mt-1 font-medium text-zinc-900">{equipment.publicId}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">Refrigerante</div>
            <div className="mt-1 font-medium text-zinc-900">{equipment.refrigerant ?? "—"}</div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">Capacidad</div>
            <div className="mt-1 font-medium text-zinc-900">{equipment.capacity ?? "—"}</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
          <div className="text-xs text-zinc-500">Ubicación</div>
          <div className="mt-1 font-medium text-zinc-900">{equipment.locationAddress ?? "—"}</div>
        </div>

        <Link href="/equipments" className="mt-3 inline-block text-sm underline">
          Volver a equipos
        </Link>
      </div>

      <div className="mt-3">
        <MaintenanceForm
          canEdit={canManageMaintenance}
          clientHasEmail={Boolean(equipment.client?.email)}
          clientHasPhone={Boolean(equipment.client?.phone)}
          upgradeHref="/account/plan"
          initial={{
            nextDate: (equipment.maintenancePlan?.nextDate ?? new Date(Date.now() + 30 * 86400000))
              .toISOString()
              .slice(0, 10),
            daysBefore: equipment.maintenancePlan?.daysBefore ?? 7,
            notifyEmail: equipment.maintenancePlan?.notifyEmail ?? false,
            notifyMessage: equipment.maintenancePlan?.notifyMessage ?? false,
          }}
          action={saveMaintenance}
        />
      </div>

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Historial (OT)</div>
        <div className="mt-3 space-y-2">
          {equipment.workOrders.length === 0 ? (
            <div className="text-sm text-zinc-600">Sin órdenes.</div>
          ) : (
            equipment.workOrders.map((wo) => (
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
                      {new Date(wo.createdAt).toLocaleString()}
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
