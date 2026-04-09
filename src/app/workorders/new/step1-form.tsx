"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClientOpt = { id: string; name: string };
type EquipmentOpt = {
  id: string;
  clientId: string | null;
  type: string;
  customType?: string | null;
  brand: string | null;
  model: string | null;
};

export function Step1Form({
  workOrderId,
  clients,
  equipments,
  defaultClientId,
  defaultEquipmentId,
  defaultServiceAddress,
  defaultServiceType,
  defaultNotes,
  action,
}: {
  workOrderId: string;
  clients: ClientOpt[];
  equipments: EquipmentOpt[];
  defaultClientId: string;
  defaultEquipmentId: string;
  defaultServiceAddress: string;
  defaultServiceType: string;
  defaultNotes: string;
  action: (formData: FormData) => void;
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [clientQuery, setClientQuery] = useState("");

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;

    const matches = clients.filter((c) => c.name.toLowerCase().includes(q));

    // Keep current selection visible even if it doesn't match the query.
    if (!clientId) return matches;
    if (matches.some((c) => c.id === clientId)) return matches;
    const selected = clients.find((c) => c.id === clientId);
    return selected ? [selected, ...matches] : matches;
  }, [clientQuery, clients, clientId]);

  const filtered = useMemo(() => {
    if (!clientId) return equipments;
    return equipments.filter((e) => e.clientId === clientId);
  }, [clientId, equipments]);

  const callbackClient = useMemo(() => {
    const base = workOrderId
      ? `/workorders/new?step=1&id=${encodeURIComponent(workOrderId)}&clientId=__CLIENT_ID__`
      : `/workorders/new?step=1&clientId=__CLIENT_ID__`;
    return encodeURIComponent(base);
  }, [workOrderId]);

  const callbackEquipment = useMemo(() => {
    const base = workOrderId
      ? `/workorders/new?step=1&id=${encodeURIComponent(workOrderId)}&equipmentId=__EQUIPMENT_ID__`
      : `/workorders/new?step=1&equipmentId=__EQUIPMENT_ID__`;
    return encodeURIComponent(base);
  }, [workOrderId]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/clients/new?callbackUrl=${callbackClient}`}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
        >
          + Cliente
        </Link>
        <Link
          aria-disabled={!clientId}
          href={
            clientId
              ? `/equipments/new?clientId=${encodeURIComponent(clientId)}&callbackUrl=${callbackEquipment}`
              : "#"
          }
          className={
            "inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-medium shadow-sm transition-colors " +
            (clientId
              ? "text-zinc-900 hover:bg-zinc-50"
              : "cursor-not-allowed text-zinc-400")
          }
        >
          + Equipo
        </Link>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900">Cliente</label>
        <input
          value={clientQuery}
          onChange={(e) => setClientQuery(e.target.value)}
          placeholder="Buscar cliente por nombre..."
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
        />
        <select
          name="clientId"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
          }}
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">(Crear demo si vacío)</option>
          {filteredClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900">Equipo</label>
        <select
          name="equipmentId"
          defaultValue={defaultEquipmentId}
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="">(Crear demo si vacío)</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>
              {e.type === "OTRO" ? e.customType || "OTRO" : e.type}
              {e.brand ? ` • ${e.brand}` : ""}
              {e.model ? ` ${e.model}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900">Dirección del servicio</label>
        <input
          name="serviceAddress"
          defaultValue={defaultServiceAddress}
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="Dirección"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900">Tipo de servicio</label>
        <select
          name="serviceType"
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
          defaultValue={defaultServiceType || "FALLA"}
        >
          <option value="FALLA">FALLA</option>
          <option value="MANTENIMIENTO">MANTENIMIENTO</option>
          <option value="INSTALACION">INSTALACION</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900">Notas</label>
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaultNotes}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
          placeholder="Descripción breve"
        />
      </div>

      <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
        Continuar
      </button>
    </form>
  );
}
