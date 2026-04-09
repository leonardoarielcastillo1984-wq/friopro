import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";
import { assertCanCallAi, assertCanGeneratePdf } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const wo = await prisma.workOrder.findFirst({
    where: { id, userId: user.id },
    include: {
      client: true,
      equipment: true,
      measurements: true,
      evidencePhotos: { orderBy: { createdAt: "desc" } },
      pdfReport: true,
      diagnosis: true,
    },
  });

  if (!wo) {
    return (
      <MobileShell brand="friopro" title="Orden" userLabel={user.email} active="workorders">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">OT no encontrada</h1>
          <p className="mt-2 text-sm text-zinc-600">No existe o no tenés acceso.</p>
          <Link href="/workorders" className="mt-4 inline-block text-sm underline">
            Volver
          </Link>
        </div>
      </MobileShell>
    );
  }

  async function generatePdf(formData: FormData) {
    "use server";
    const user = await requireAuth();
    let access: Awaited<ReturnType<typeof assertCanGeneratePdf>>;
    try {
      access = await assertCanGeneratePdf(user.id);
    } catch (e: any) {
      const msg =
        e?.message === "PDF_LIMIT_REACHED"
          ? "L%C3%ADmite%20mensual%20de%20PDF%20alcanzado.%20Actualiz%C3%A1%20tu%20plan."
          : "Tu%20plan%20no%20permite%20generar%20PDF.%20Actualiz%C3%A1%20tu%20plan.";
      redirect(`/workorders/${String(formData.get("workOrderId") ?? "")}?error=${msg}`);
    }
    const workOrderId = String(formData.get("workOrderId") ?? "");
    if (!workOrderId) return;

    const owned = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      include: { pdfReport: true },
    });

    if (!owned) {
      redirect(`/workorders/${workOrderId}?error=OT%20no%20encontrada`);
    }

    await prisma.pdfReport.upsert({
      where: { workOrderId },
      update: {
        fileUrl: `https://example.com/reports/${workOrderId}.pdf`,
      },
      create: {
        workOrderId,
        fileUrl: `https://example.com/reports/${workOrderId}.pdf`,
      },
    });

    if (!owned.pdfReport) {
      await prisma.usageEvent.create({
        data: {
          licenseId: access.licenseId,
          type: "PDF_GENERATED",
          meta: { workOrderId },
        },
      });
    }

    redirect(`/workorders/${workOrderId}?ok=PDF%20generado`);
  }

  async function callAi(formData: FormData) {
    "use server";
    const user = await requireAuth();
    let access: Awaited<ReturnType<typeof assertCanCallAi>>;
    try {
      access = await assertCanCallAi(user.id);
    } catch (e: any) {
      const msg =
        e?.message === "AI_LIMIT_REACHED"
          ? "L%C3%ADmite%20mensual%20de%20IA%20alcanzado.%20Actualiz%C3%A1%20tu%20plan."
          : "La%20IA%20est%C3%A1%20disponible%20solo%20en%20PRO%2B.%20Actualiz%C3%A1%20tu%20plan.";
      redirect(`/workorders/${String(formData.get("workOrderId") ?? "")}?error=${msg}`);
    }
    const workOrderId = String(formData.get("workOrderId") ?? "");
    if (!workOrderId) return;

    const owned = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      select: { id: true },
    });

    if (!owned) {
      redirect(`/workorders/${workOrderId}?error=OT%20no%20encontrada`);
    }

    await prisma.diagnosis.upsert({
      where: { workOrderId },
      update: {
        aiClientSummary: "(stub) Resumen generado por IA",
        aiRecommendations: "(stub) Recomendaciones",
        aiAlerts: "(stub) Alertas",
      },
      create: {
        workOrderId,
        aiClientSummary: "(stub) Resumen generado por IA",
        aiRecommendations: "(stub) Recomendaciones",
        aiAlerts: "(stub) Alertas",
      },
    });

    await prisma.usageEvent.create({
      data: {
        licenseId: access.licenseId,
        type: "AI_CALL",
        meta: { workOrderId },
      },
    });

    redirect(`/workorders/${workOrderId}?ok=IA%20ejecutada`);
  }

  async function setStatus(formData: FormData) {
    "use server";
    const user = await requireAuth();
    const workOrderId = String(formData.get("workOrderId") ?? "");
    const next = String(formData.get("next") ?? "");
    if (!workOrderId) return;

    const wo = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      include: { measurements: true, evidencePhotos: true, pdfReport: true },
    });

    if (!wo) {
      redirect(`/workorders/${workOrderId}?error=OT%20no%20encontrada`);
    }

    if (next !== "IN_PROGRESS" && next !== "CANCELLED" && next !== "COMPLETED") {
      redirect(`/workorders/${workOrderId}?error=Estado%20inv%C3%A1lido`);
    }

    if (next === "COMPLETED") {
      if (!wo.measurements) {
        redirect(`/workorders/${workOrderId}?error=No%20pod%C3%A9s%20cerrar%20sin%20mediciones`);
      }
      if (wo.evidencePhotos.length < 2) {
        redirect(`/workorders/${workOrderId}?error=No%20pod%C3%A9s%20cerrar%20sin%20m%C3%ADnimo%202%20fotos`);
      }

      if (!wo.pdfReport) {
        try {
          const access = await assertCanGeneratePdf(user.id);

          await prisma.pdfReport.create({
            data: {
              workOrderId,
              fileUrl: `https://example.com/reports/${workOrderId}.pdf`,
            },
          });

          await prisma.usageEvent.create({
            data: {
              licenseId: access.licenseId,
              type: "PDF_GENERATED",
              meta: { workOrderId },
            },
          });
        } catch (e: any) {
          const msg =
            e?.message === "PDF_LIMIT_REACHED"
              ? "L%C3%ADmite%20mensual%20de%20PDF%20alcanzado.%20Actualiz%C3%A1%20tu%20plan."
              : "Tu%20plan%20no%20permite%20generar%20PDF.%20Actualiz%C3%A1%20tu%20plan.";
          redirect(`/workorders/${workOrderId}?error=${msg}`);
        }
      }
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: next as any },
    });

    redirect(`/workorders/${workOrderId}?ok=Estado%20actualizado`);
  }

  const sp = (await searchParams) ?? {};
  const error = (sp.error ?? "").trim();
  const ok = (sp.ok ?? "").trim();

  return (
    <MobileShell
      brand="friopro"
      title={`ORD-${wo.id.slice(0, 4).toUpperCase()}`}
      userLabel={user.email}
      active="workorders"
    >
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold">{wo.client.name}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {wo.equipment.type} • {wo.serviceType}
            </div>
          </div>

          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            {wo.status}
          </div>
        </div>

        {wo.notes ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {wo.notes}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <Link href="/workorders" className="text-sm underline">
            Volver
          </Link>
          <div className="text-xs text-zinc-500">
            {new Date(wo.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>{error}</div>
          <div className="mt-2">
            <Link href="/account/plan" className="text-sm underline">
              Actualizar plan
            </Link>
          </div>
        </div>
      ) : null}

      {ok ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Acciones</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <form action={generatePdf}>
            <input type="hidden" name="workOrderId" value={wo.id} />
            <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50">
              PDF
            </button>
          </form>

          <form action={callAi}>
            <input type="hidden" name="workOrderId" value={wo.id} />
            <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50">
              IA
            </button>
          </form>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Registra uso y se bloquea si tu licencia/plan no lo permite.
        </div>
      </div>

      {wo.status === "DRAFT" ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Wizard</div>
          <div className="mt-2 text-sm text-zinc-600">
            Esta OT está en borrador. Completá los pasos obligatorios.
          </div>
          <Link
            href={`/workorders/new?step=1&id=${wo.id}`}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Continuar wizard
          </Link>
        </div>
      ) : null}

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Resumen</div>

        <div className="mt-3 grid gap-3">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="text-xs text-zinc-500">Síntomas</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.isArray(wo.symptoms) && (wo.symptoms as any[]).length > 0 ? (
                (wo.symptoms as any[]).map((s, idx) => (
                  <span
                    key={`${idx}-${String(s)}`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm"
                  >
                    {String(s)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">—</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">Mediciones</div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {wo.measurements ? "OK" : "Faltan"}
              </div>
            </div>
            {wo.measurements ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-700">
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Succión: {wo.measurements.suctionPressure ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Descarga: {wo.measurements.dischargePressure ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Retorno: {wo.measurements.returnTemp ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Impulsión: {wo.measurements.supplyTemp ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">A: {wo.measurements.compressorCurrent ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">V: {wo.measurements.voltage ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Vacío: {wo.measurements.vacuumValue ?? "—"}</div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">Tiempo: {wo.measurements.vacuumTime ?? "—"}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-600">Completá mediciones en el wizard.</div>
            )}
          </div>

          <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">Evidencia</div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                {wo.evidencePhotos.length} fotos
              </div>
            </div>

            {wo.evidencePhotos.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {wo.evidencePhotos.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    title={p.category ?? ""}
                  >
                    <img src={p.fileUrl} alt={p.category ?? "evidencia"} className="h-24 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-zinc-600">Subí evidencia en el wizard.</div>
            )}

            <Link
              href={`/workorders/new?step=4&id=${wo.id}`}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Agregar evidencia
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Estado</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="text-xs text-zinc-500">PDF</div>
            <div className="mt-1 font-medium text-zinc-900">{wo.pdfReport ? "Generado" : "—"}</div>
            {wo.pdfReport ? (
              <a
                href={wo.pdfReport.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs underline"
              >
                Ver PDF
              </a>
            ) : null}
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
            <div className="text-xs text-zinc-500">Diagnóstico IA</div>
            <div className="mt-1 font-medium text-zinc-900">{wo.diagnosis ? "Generado" : "—"}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {wo.status !== "COMPLETED" ? (
            <form action={setStatus}>
              <input type="hidden" name="workOrderId" value={wo.id} />
              <input type="hidden" name="next" value="CANCELLED" />
              <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50">
                Pendiente
              </button>
            </form>
          ) : (
            <div className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-100 text-sm font-medium text-zinc-700">
              Cerrada
            </div>
          )}

          {wo.status !== "COMPLETED" ? (
            <form action={setStatus}>
              <input type="hidden" name="workOrderId" value={wo.id} />
              <input type="hidden" name="next" value="COMPLETED" />
              <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800">
                Cerrar
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          No se puede completar sin mediciones y mínimo 2 fotos.
        </div>
      </div>
    </MobileShell>
  );
}
