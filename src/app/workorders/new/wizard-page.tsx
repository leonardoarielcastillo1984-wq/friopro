import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";
import { assertCanCreateWorkOrder, getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";
import { TrialExpiredModal } from "@/app/ui/trial-expired-modal";
import { EvidenceUploader } from "@/app/workorders/new/evidence-uploader";
import { Step1Form } from "@/app/workorders/new/step1-form";
import {
  getOrCreateDemoClient,
  getOrCreateDemoEquipment,
  SYMPTOM_CHIPS,
  toSymptomsJson,
} from "@/app/workorders/new/wizard-helpers";

type SP = {
  step?: string;
  id?: string;
  clientId?: string;
  equipmentId?: string;
  error?: string;
};

function nOrNull(value: string | null) {
  const v = (value ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value: string | null) {
  const n = nOrNull(value);
  if (n === null) return null;
  return Math.trunc(n);
}

export default async function NewWorkOrderWizardPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};

  const access = await getAccessState(user.id);
  const overlay =
    access.mode === "READ_ONLY" && access.reason === "TRIAL_EXPIRED" ? (
      <TrialExpiredModal message="Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro." />
    ) : undefined;

  const step = Math.min(4, Math.max(1, Number(sp.step ?? "1") || 1));
  const id = (sp.id ?? "").trim();
  const preClientId = (sp.clientId ?? "").trim();
  const preEquipmentId = (sp.equipmentId ?? "").trim();
  const error = (sp.error ?? "").trim();

  const [clients, equipments, draft] = await Promise.all([
    prisma.client.findMany({
      where: { userId: user.id },
      orderBy: { id: "desc" },
      select: { id: true, name: true, address: true },
      take: 200,
    }),
    prisma.equipment.findMany({
      where: { userId: user.id },
      orderBy: { id: "desc" },
      select: {
        id: true,
        clientId: true,
        type: true,
        customType: true,
        brand: true,
        model: true,
      },
      take: 300,
    }),
    id
      ? prisma.workOrder.findFirst({
          where: { id, userId: user.id },
          include: {
            client: true,
            equipment: true,
            measurements: true,
            evidencePhotos: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (draft?.status === "COMPLETED" || draft?.status === "CANCELLED") {
    redirect(`/workorders/${draft.id}?error=La%20OT%20est%C3%A1%20cerrada%20y%20no%20se%20puede%20editar`);
  }

  async function saveStep1(formData: FormData) {
    "use server";
    const user = await requireAuth();

    const currentId = String(formData.get("workOrderId") ?? "").trim();
    const clientIdRaw = String(formData.get("clientId") ?? "").trim();
    const equipmentIdRaw = String(formData.get("equipmentId") ?? "").trim();
    const serviceAddress = String(formData.get("serviceAddress") ?? "").trim();
    const serviceType = String(formData.get("serviceType") ?? "FALLA").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (
      serviceType !== "FALLA" &&
      serviceType !== "MANTENIMIENTO" &&
      serviceType !== "INSTALACION"
    ) {
      redirect("/workorders/new?step=1&error=Tipo%20de%20servicio%20inv%C3%A1lido");
    }

    let access: Awaited<ReturnType<typeof assertCanCreateWorkOrder>>;
    try {
      access = await assertCanCreateWorkOrder(user.id);
    } catch (e: any) {
      const state = await getAccessState(user.id);
      const msg =
        state.mode === "READ_ONLY" && state.reason === "TRIAL_EXPIRED"
          ? "Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro."
          : "Modo solo lectura.";
      redirect(`/workorders/new?step=1&error=${encodeURIComponent(msg)}`);
    }

    const client = clientIdRaw
      ? await prisma.client.findFirst({ where: { id: clientIdRaw, userId: user.id } })
      : await getOrCreateDemoClient(user.id);

    if (!client) {
      redirect("/workorders/new?step=1&error=Cliente%20inv%C3%A1lido");
    }

    const equipment = equipmentIdRaw
      ? await prisma.equipment.findFirst({ where: { id: equipmentIdRaw, userId: user.id } })
      : await getOrCreateDemoEquipment(user.id, client.id);

    if (!equipment) {
      redirect("/workorders/new?step=1&error=Equipo%20inv%C3%A1lido");
    }

    const fullNotes = (serviceAddress ? `Dirección del servicio: ${serviceAddress}\n` : "") + notes;

    const wo = currentId
      ? await prisma.workOrder.update({
          where: { id: currentId },
          data: {
            userId: user.id,
            clientId: client.id,
            equipmentId: equipment.id,
            serviceType: serviceType as any,
            notes: fullNotes,
          },
          select: { id: true, status: true },
        })
      : await prisma.workOrder.create({
          data: {
            userId: user.id,
            clientId: client.id,
            equipmentId: equipment.id,
            serviceType: serviceType as any,
            notes: fullNotes,
          },
          select: { id: true, status: true },
        });

    if (!currentId) {
      await prisma.usageEvent.create({
        data: {
          licenseId: access.licenseId,
          type: "WORKORDER_CREATED",
          meta: { workOrderId: wo.id },
        },
      });
    }

    redirect(`/workorders/new?step=2&id=${wo.id}`);
  }

  async function saveStep2(formData: FormData) {
    "use server";
    const user = await requireAuth();

    const workOrderId = String(formData.get("workOrderId") ?? "").trim();
    const other = String(formData.get("other") ?? "");
    const selected = formData.getAll("chips").map((v) => String(v));

    if (!workOrderId) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");

    const owned = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      select: { id: true },
    });

    if (!owned) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");

    const symptoms = toSymptomsJson(selected, other);

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { symptoms },
    });

    redirect(`/workorders/new?step=3&id=${workOrderId}`);
  }

  async function saveStep3(formData: FormData) {
    "use server";
    const user = await requireAuth();

    const workOrderId = String(formData.get("workOrderId") ?? "").trim();
    if (!workOrderId) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");

    const owned = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      select: { id: true },
    });

    if (!owned) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");

    const notes = String(formData.get("mNotes") ?? "").trim();

    await prisma.measurements.upsert({
      where: { workOrderId },
      update: {
        suctionPressure: nOrNull(String(formData.get("suctionPressure") ?? "")),
        dischargePressure: nOrNull(String(formData.get("dischargePressure") ?? "")),
        returnTemp: nOrNull(String(formData.get("returnTemp") ?? "")),
        supplyTemp: nOrNull(String(formData.get("supplyTemp") ?? "")),
        compressorCurrent: nOrNull(String(formData.get("compressorCurrent") ?? "")),
        voltage: nOrNull(String(formData.get("voltage") ?? "")),
        ambientTemp: nOrNull(String(formData.get("ambientTemp") ?? "")),
        vacuumValue: nOrNull(String(formData.get("vacuumValue") ?? "")),
        vacuumTime: intOrNull(String(formData.get("vacuumTime") ?? "")),
        notes: notes || null,
      },
      create: {
        workOrderId,
        suctionPressure: nOrNull(String(formData.get("suctionPressure") ?? "")),
        dischargePressure: nOrNull(String(formData.get("dischargePressure") ?? "")),
        returnTemp: nOrNull(String(formData.get("returnTemp") ?? "")),
        supplyTemp: nOrNull(String(formData.get("supplyTemp") ?? "")),
        compressorCurrent: nOrNull(String(formData.get("compressorCurrent") ?? "")),
        voltage: nOrNull(String(formData.get("voltage") ?? "")),
        ambientTemp: nOrNull(String(formData.get("ambientTemp") ?? "")),
        vacuumValue: nOrNull(String(formData.get("vacuumValue") ?? "")),
        vacuumTime: intOrNull(String(formData.get("vacuumTime") ?? "")),
        notes: notes || null,
      },
    });

    redirect(`/workorders/new?step=4&id=${workOrderId}`);
  }

  async function finalize(formData: FormData) {
    "use server";
    const user = await requireAuth();

    const workOrderId = String(formData.get("workOrderId") ?? "").trim();
    if (!workOrderId) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");

    const wo = await prisma.workOrder.findFirst({
      where: { id: workOrderId, userId: user.id },
      include: { measurements: true, evidencePhotos: true },
    });

    if (!wo) redirect("/workorders/new?step=1&error=OT%20inv%C3%A1lida");
    if (!wo.measurements) {
      redirect(`/workorders/new?step=3&id=${workOrderId}&error=Complet%C3%A1%20mediciones`);
    }
    if (wo.evidencePhotos.length < 2) {
      redirect(`/workorders/new?step=4&id=${workOrderId}&error=Sub%C3%AD%20m%C3%ADnimo%202%20fotos`);
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: "IN_PROGRESS" },
    });

    redirect(`/workorders/${workOrderId}?ok=OT%20iniciada`);
  }

  const wizardId = draft?.id ?? id;
  const evidenceCount = draft?.evidencePhotos?.length ?? 0;
  const symptoms = Array.isArray(draft?.symptoms) ? (draft?.symptoms as any[]) : [];
  const selectedSymptoms = new Set(symptoms.map((s) => String(s)));

  const defaultClientId = preClientId || draft?.clientId || "";
  const defaultEquipmentId = preEquipmentId || draft?.equipmentId || "";

  return (
    <MobileShell brand="friopro" title={`Nueva orden • Paso ${step}/4`} userLabel={user.email} active="workorders" overlay={overlay}>
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <Step1Form
            workOrderId={draft?.id ?? ""}
            clients={clients}
            equipments={equipments}
            defaultClientId={defaultClientId}
            defaultEquipmentId={defaultEquipmentId}
            defaultServiceAddress={draft?.client?.address ?? ""}
            defaultServiceType={draft?.serviceType ?? "FALLA"}
            defaultNotes={draft?.notes ?? ""}
            action={saveStep1}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <form action={saveStep2} className="grid gap-4">
            <input type="hidden" name="workOrderId" value={wizardId} />

            <div className="text-sm font-semibold">Síntomas</div>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_CHIPS.map((s) => (
                <label
                  key={s}
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700"
                >
                  <input
                    type="checkbox"
                    name="chips"
                    value={s}
                    defaultChecked={selectedSymptoms.has(s)}
                  />
                  {s}
                </label>
              ))}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900">Otro</label>
              <input
                name="other"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="Texto libre"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={`/workorders/new?step=1&id=${wizardId}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm"
              >
                Atrás
              </a>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                Continuar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <form action={saveStep3} className="grid gap-3">
            <input type="hidden" name="workOrderId" value={wizardId} />

            <div className="text-sm font-semibold">Mediciones técnicas</div>

            <div className="grid grid-cols-2 gap-3">
              <input
                name="suctionPressure"
                type="number"
                step="any"
                placeholder="Presión succión"
                defaultValue={draft?.measurements?.suctionPressure ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="dischargePressure"
                type="number"
                step="any"
                placeholder="Presión descarga"
                defaultValue={draft?.measurements?.dischargePressure ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="returnTemp"
                type="number"
                step="any"
                placeholder="Temp retorno"
                defaultValue={draft?.measurements?.returnTemp ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="supplyTemp"
                type="number"
                step="any"
                placeholder="Temp impulsión"
                defaultValue={draft?.measurements?.supplyTemp ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="compressorCurrent"
                type="number"
                step="any"
                placeholder="Amperaje"
                defaultValue={draft?.measurements?.compressorCurrent ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="voltage"
                type="number"
                step="any"
                placeholder="Voltaje"
                defaultValue={draft?.measurements?.voltage ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="vacuumValue"
                type="number"
                step="any"
                placeholder="Vacío (valor)"
                defaultValue={draft?.measurements?.vacuumValue ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
              <input
                name="vacuumTime"
                type="number"
                step="1"
                placeholder="Vacío (min)"
                defaultValue={draft?.measurements?.vacuumTime ?? ""}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
              />
            </div>

            <textarea
              name="mNotes"
              rows={3}
              defaultValue={draft?.measurements?.notes ?? ""}
              placeholder="Observaciones"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <a
                href={`/workorders/new?step=2&id=${wizardId}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm"
              >
                Atrás
              </a>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                Continuar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <EvidenceUploader workOrderId={wizardId} initialCount={evidenceCount} />

          <form action={finalize} className="mt-4 grid gap-3">
            <input type="hidden" name="workOrderId" value={wizardId} />
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`/workorders/new?step=3&id=${wizardId}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm"
              >
                Atrás
              </a>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
                Finalizar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </MobileShell>
  );
}
