import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { assertCanCreateClient, getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const user = await requireAuth();

  async function createClient(formData: FormData) {
    "use server";

    const user = await requireAuth();

    try {
      await assertCanCreateClient(user.id);
    } catch (e: any) {
      const state = await getAccessState(user.id);
      const msg =
        state.mode === "READ_ONLY" && state.reason === "TRIAL_EXPIRED"
          ? "Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro."
          : "El plan FREE permite hasta 2 clientes y 2 equipos. Actualizá tu plan para continuar.";
      redirect(`/clients/new?error=${encodeURIComponent(msg)}`);
    }

    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const callbackUrl = String(formData.get("callbackUrl") ?? "").trim();

    if (!name) {
      redirect("/clients/new?error=Nombre%20requerido");
    }

    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
      select: { id: true },
    });

    if (callbackUrl) {
      redirect(callbackUrl.replace("__CLIENT_ID__", client.id));
    }

    redirect(`/clients/${client.id}`);
  }

  const sp = (await searchParams) ?? {};
  const error = (sp.error ?? "").trim();
  const callbackUrl = (sp.callbackUrl ?? "").trim();

  return (
    <MobileShell brand="friopro" title="Nuevo cliente" userLabel={user.email} active="clients">
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
        <form action={createClient} className="grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Nombre del cliente"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900" htmlFor="phone">
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="(opcional)"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-900" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="(opcional)"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900" htmlFor="address">
              Dirección
            </label>
            <input
              id="address"
              name="address"
              className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="(opcional)"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-900" htmlFor="notes">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="(opcional)"
            />
          </div>

          <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
            Guardar cliente
          </button>
        </form>
      </div>
    </MobileShell>
  );
}
