import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

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

export default async function EquipmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string; q?: string }>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};
  const clientId = (sp.clientId ?? "").trim();
  const q = (sp.q ?? "").trim();

  const equipments = await prisma.equipment.findMany({
    where: {
      userId: user.id,
      ...(clientId ? { clientId } : {}),
      ...(q
        ? {
            OR: [
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { serial: { contains: q, mode: "insensitive" } },
              { publicId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    include: { client: { select: { name: true } } },
    take: 200,
  });

  return (
    <MobileShell brand="friopro" title="Equipos" userLabel={user.email} active="clients">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Equipos</div>
          <div className="text-xs text-zinc-500">Últimos {equipments.length}</div>
        </div>
        <Link
          href="/equipments/new"
          className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + Nuevo
        </Link>
      </div>

      <form action="/equipments" method="get" className="mt-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar equipos..."
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm outline-none focus:border-zinc-400"
        />
      </form>

      <div className="mt-4 space-y-3">
        {equipments.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Sin equipos.
          </div>
        ) : (
          equipments.map((e) => (
            <Link
              key={e.id}
              href={`/equipments/${e.id}`}
              className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {typeLabel(e.type as any, (e as any).customType)}
                    {e.brand ? ` • ${e.brand}` : ""}
                    {e.model ? ` ${e.model}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {e.client?.name ? `Cliente: ${e.client.name}` : "Sin cliente"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">QR: {e.publicId}</div>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                  {e.serial ?? "—"}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
