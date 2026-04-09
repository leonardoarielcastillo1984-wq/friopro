"use client";

import { useMemo, useState, useTransition } from "react";

type Evidence = { id: string; fileUrl: string };

export function EvidenceUploader({
  workOrderId,
  initialCount,
}: {
  workOrderId: string;
  initialCount: number;
}) {
  const [category, setCategory] = useState<string>("antes");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number>(initialCount);
  const [isPending, startTransition] = useTransition();

  const previews = useMemo(() => {
    return files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
  }, [files]);

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("workOrderId", workOrderId);

    const res = await fetch("/api/uploads", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "UPLOAD_FAILED");
    }

    const body = (await res.json()) as {
      ok: true;
      evidence: Evidence;
      count: number;
    };

    setCount(body.count);
  }

  function onSubmit() {
    setError(null);

    if (files.length === 0) {
      setError("Seleccioná al menos 1 foto.");
      return;
    }

    startTransition(async () => {
      try {
        for (const f of files) {
          await uploadOne(f);
        }
        setFiles([]);
      } catch (e: any) {
        setError("No se pudo subir. Probá de nuevo.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Evidencia</div>
        <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          {count} fotos
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm"
        >
          <option value="placa">Placa</option>
          <option value="manometros">Manómetros</option>
          <option value="instalacion">Instalación</option>
          <option value="antes">Antes</option>
          <option value="despues">Después</option>
          <option value="otros">Otros</option>
        </select>

        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((p) => (
            <div
              key={p.url}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-70"
      >
        {isPending ? "Subiendo..." : "Subir fotos"}
      </button>

      <div className="text-xs text-zinc-500">
        Mínimo 2 fotos para avanzar.
      </div>
    </div>
  );
}
