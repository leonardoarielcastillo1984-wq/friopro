"use client";

import { useId, useState } from "react";

export function EquipmentTypePicker({
  defaultType,
}: {
  defaultType?: string;
}) {
  const id = useId();
  const [type, setType] = useState<string>(defaultType ?? "SPLIT_INVERTER");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-900" htmlFor={`${id}-type`}>
          Tipo
        </label>
        <select
          id={`${id}-type`}
          name="type"
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            setType(next);

            if (next !== "OTRO") {
              const input = document.querySelector(
                `input[name=\"customType\"]`,
              ) as HTMLInputElement | null;
              if (input) input.value = "";
            }
          }}
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="SPLIT_INVERTER">Aire split (inverter)</option>
          <option value="SPLIT_ON_OFF">Aire split (on/off)</option>
          <option value="VENTANA">Aire ventana</option>
          <option value="HELADERA">Heladera</option>
          <option value="FREEZER">Congelador</option>
          <option value="CAMARA">Cámara</option>
          <option value="OTRO">Otro (campo libre)</option>
        </select>
      </div>

      {type === "OTRO" ? (
        <div className="grid gap-2">
          <label className="text-sm font-medium text-zinc-900" htmlFor={`${id}-custom`}>
            Tipo (campo libre)
          </label>
          <input
            id={`${id}-custom`}
            name="customType"
            className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
            placeholder="Ej: Azotea, VRF, etc."
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  );
}
