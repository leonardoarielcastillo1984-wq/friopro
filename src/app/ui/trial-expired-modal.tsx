"use client";

import Link from "next/link";

export function TrialExpiredModal({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl">
        <div className="text-sm font-semibold text-zinc-900">FríoPro</div>
        <div className="mt-2 text-base font-semibold text-zinc-900">Acceso bloqueado</div>
        <div className="mt-2 text-sm text-zinc-600">{message}</div>

        <div className="mt-4 grid gap-2">
          <Link
            href="/account/plan"
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}
