import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { assertCanCreateEquipment, getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";
import { EquipmentTypePicker } from "@/app/equipments/new/type-picker";

type SP = { clientId?: string; callbackUrl?: string; error?: string };

function normalizeCallbackUrl(raw: string | null) {
  const v = (raw ?? "").trim();
  return v || null;
}

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};

  const clientId = (sp.clientId ?? "").trim();
  const callbackUrl = normalizeCallbackUrl(sp.callbackUrl ?? null);
  const error = (sp.error ?? "").trim();

  const clients = await prisma.client.findMany({
    where: { userId: user.id },
    orderBy: { id: "desc" },
    select: { id: true, name: true },
    take: 200,
  });

  async function createEquipment(formData: FormData) {
    "use server";

    const user = await requireAuth();

    try {
      await assertCanCreateEquipment(user.id);
    } catch (e: any) {
      const state = await getAccessState(user.id);
      const msg =
        state.mode === "READ_ONLY" && state.reason === "TRIAL_EXPIRED"
          ? "Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro."
          : "El plan FREE permite hasta 2 clientes y 2 equipos. Actualizá tu plan para continuar.";
      redirect(`/equipments/new?error=${encodeURIComponent(msg)}`);
    }

    const type = String(formData.get("type") ?? "SPLIT_INVERTER").trim();
    const customType = String(formData.get("customType") ?? "").trim() || null;
    const clientId = String(formData.get("clientId") ?? "").trim() || null;
    const brand = String(formData.get("brand") ?? "").trim() || null;
    const model = String(formData.get("model") ?? "").trim() || null;
    const serial = String(formData.get("serial") ?? "").trim() || null;
    const refrigerant = String(formData.get("refrigerant") ?? "").trim() || null;
    const capacity = String(formData.get("capacity") ?? "").trim() || null;
    const locationAddress = String(formData.get("locationAddress") ?? "").trim() || null;
    const callbackUrl = normalizeCallbackUrl(String(formData.get("callbackUrl") ?? ""));

    const okType =
      type === "SPLIT_INVERTER" ||
      type === "SPLIT_ON_OFF" ||
      type === "VENTANA" ||
      type === "HELADERA" ||
      type === "FREEZER" ||
      type === "CAMARA" ||
      type === "OTRO";

    if (!okType) {
      redirect("/equipments/new?error=Tipo%20inv%C3%A1lido");
    }

    if (type === "OTRO" && !customType) {
      redirect("/equipments/new?error=Indic%C3%A1%20el%20tipo%20de%20equipo");
    }

    if (clientId) {
      const owned = await prisma.client.findFirst({ where: { id: clientId, userId: user.id }, select: { id: true } });
      if (!owned) {
        redirect("/equipments/new?error=Cliente%20inv%C3%A1lido");
      }
    }

    const publicId = `eq-${user.id.slice(0, 8)}-${Date.now()}`;

    let equipment: { id: string };
    try {
      equipment = await prisma.equipment.create({
        data: {
          userId: user.id,
          clientId,
          type: type as any,
          customType,
          brand,
          model,
          serial,
          refrigerant,
          capacity,
          locationAddress,
          publicId,
        },
        select: { id: true },
      });
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" && e.message
          ? e.message.split("\n")[0].slice(0, 180)
          : "Error al guardar";
      redirect(`/equipments/new?error=${encodeURIComponent(msg)}`);
    }

    if (callbackUrl) {
      const url = callbackUrl.replace("__EQUIPMENT_ID__", equipment.id);
      redirect(url);
    }

    redirect(`/equipments/${equipment.id}`);
  }

  return (
    <MobileShell brand="friopro" title="Nuevo equipo" userLabel={user.email} active="clients">
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>{error}</div>
          {error.includes("plan FREE") ? (
            <div className="mt-2">
              <Link href="/account/plan" className="text-sm underline">
                Ver planes
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action={createEquipment} className="grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900">Cliente</label>
            <select
              name="clientId"
              defaultValue={clientId}
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">(opcional)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <EquipmentTypePicker defaultType="SPLIT_INVERTER" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Marca</label>
              <input name="brand" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Modelo</label>
              <input name="model" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900">Serie</label>
            <input name="serial" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Refrigerante</label>
              <input name="refrigerant" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Capacidad</label>
              <input name="capacity" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900">Dirección / ubicación</label>
            <input name="locationAddress" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm" />
          </div>

          <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
            Guardar equipo
          </button>
        </form>
      </div>
    </MobileShell>
  );
}
