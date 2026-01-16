import { prisma } from "@/lib/prisma";

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "asc" },
  });

  async function updatePlan(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const name = String(formData.get("name") ?? "");
    const maxWorkOrdersPerMonth = Number(formData.get("maxWorkOrdersPerMonth") ?? 0);
    const maxEquipments = Number(formData.get("maxEquipments") ?? 0);
    const aiEnabled = formData.get("aiEnabled") === "on";
    const pdfEnabled = formData.get("pdfEnabled") === "on";
    const qrEnabled = formData.get("qrEnabled") === "on";

    await prisma.plan.update({
      where: { id },
      data: {
        name,
        maxWorkOrdersPerMonth,
        maxEquipments,
        aiEnabled,
        pdfEnabled,
        qrEnabled,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Planes</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Editar límites por plan (Free / Pro / Pro+).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">{p.code}</div>
                <div className="text-lg font-semibold">{p.name}</div>
              </div>
            </div>

            <form action={updatePlan} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={p.id} />

              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-900">Nombre</label>
                <input
                  name="name"
                  defaultValue={p.name}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-zinc-900">
                    max_workorders_per_month
                  </label>
                  <input
                    name="maxWorkOrdersPerMonth"
                    type="number"
                    defaultValue={p.maxWorkOrdersPerMonth}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-zinc-900">
                    max_equipments
                  </label>
                  <input
                    name="maxEquipments"
                    type="number"
                    defaultValue={p.maxEquipments}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input name="aiEnabled" type="checkbox" defaultChecked={p.aiEnabled} />
                  ai_enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input name="pdfEnabled" type="checkbox" defaultChecked={p.pdfEnabled} />
                  pdf_enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input name="qrEnabled" type="checkbox" defaultChecked={p.qrEnabled} />
                  qr_enabled
                </label>
              </div>

              <div className="pt-2">
                <button className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
