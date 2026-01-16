"use client";

import { useMemo } from "react";

type Plan = {
  nextDate: string; // yyyy-mm-dd
  daysBefore: number;
  notifyEmail: boolean;
  notifyMessage: boolean;
};

export function MaintenanceForm({
  canEdit,
  clientHasEmail,
  clientHasPhone,
  initial,
  action,
  upgradeHref,
}: {
  canEdit: boolean;
  clientHasEmail: boolean;
  clientHasPhone: boolean;
  initial: Plan;
  action: (formData: FormData) => void;
  upgradeHref: string;
}) {
  const disabledReason = useMemo(() => {
    if (canEdit) return null;
    return "Disponible en PRO+";
  }, [canEdit]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!canEdit) {
      e.preventDefault();
      return;
    }

    const fd = new FormData(e.currentTarget);
    const notifyEmail = fd.get("notifyEmail") === "on";
    const notifyMessage = fd.get("notifyMessage") === "on";

    if (notifyEmail && !clientHasEmail) {
      e.preventDefault();
      window.alert("Ingresá el email del cliente para activar este aviso");
      return;
    }

    if (notifyMessage && !clientHasPhone) {
      e.preventDefault();
      window.alert("Ingresá el teléfono del cliente para activar este aviso");
      return;
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Próximo mantenimiento</div>
          <div className="mt-1 text-xs text-zinc-500">Recordatorios automáticos (solo PRO+)</div>
        </div>

        {!canEdit ? (
          <a
            href={upgradeHref}
            className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white shadow-sm"
          >
            Actualizar plan
          </a>
        ) : null}
      </div>

      <form action={action} onSubmit={onSubmit} className="mt-4 grid gap-4">
        <div className={"grid gap-2 " + (!canEdit ? "opacity-60" : "")}
          aria-disabled={!canEdit}
        >
          <label className="text-sm font-medium text-zinc-900">Fecha</label>
          <input
            type="date"
            name="nextDate"
            defaultValue={initial.nextDate}
            disabled={!canEdit}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
          />
        </div>

        <div className={"grid gap-2 " + (!canEdit ? "opacity-60" : "")}
          aria-disabled={!canEdit}
        >
          <label className="text-sm font-medium text-zinc-900">Avisar con</label>
          <select
            name="daysBefore"
            defaultValue={String(initial.daysBefore)}
            disabled={!canEdit}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
          >
            <option value="1">1 día</option>
            <option value="3">3 días</option>
            <option value="7">7 días</option>
            <option value="14">14 días</option>
            <option value="30">30 días</option>
          </select>
        </div>

        <div className={"space-y-2 " + (!canEdit ? "opacity-60" : "")}
          aria-disabled={!canEdit}
        >
          <div className="text-sm font-medium text-zinc-900">Recordatorios automáticos</div>
          <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm">
            <div>
              <div className="font-medium">Correo electrónico</div>
              <div className="text-xs text-zinc-500">Requiere email del cliente</div>
            </div>
            <input type="checkbox" name="notifyEmail" defaultChecked={initial.notifyEmail} disabled={!canEdit} />
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm">
            <div>
              <div className="font-medium">Mensaje</div>
              <div className="text-xs text-zinc-500">SMS o WhatsApp (mock)</div>
            </div>
            <input type="checkbox" name="notifyMessage" defaultChecked={initial.notifyMessage} disabled={!canEdit} />
          </label>
        </div>

        {disabledReason ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {disabledReason}
          </div>
        ) : null}

        <button
          disabled={!canEdit}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar recordatorio
        </button>
      </form>
    </div>
  );
}
