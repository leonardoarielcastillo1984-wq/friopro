import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";
import { getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

type SP = { plan?: string };

function priceFor(plan: string) {
  if (plan === "FREE") return { amount: "0.00", currency: "ARS" };
  if (plan === "PRO") return { amount: "9000.00", currency: "ARS" };
  if (plan === "PRO_PLUS") return { amount: "15000.00", currency: "ARS" };
  return null;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};
  const plan = (sp.plan ?? "").trim();

  if (plan !== "FREE" && plan !== "PRO" && plan !== "PRO_PLUS") {
    redirect("/account/plan?error=Plan%20inv%C3%A1lido");
  }

  const access = await getAccessState(user.id);
  const current = access.mode === "FULL" ? access.planCode : "FREE";
  if (current === plan) {
    redirect("/account/plan?ok=Ya%20ten%C3%A9s%20ese%20plan");
  }

  const price = priceFor(plan);
  if (!price) redirect("/account/plan?error=Plan%20inv%C3%A1lido");

  async function confirmPayment() {
    "use server";

    const user = await requireAuth();

    const planCode = plan as any;
    const price = priceFor(plan);
    if (!price) {
      redirect("/account/plan?error=Plan%20inv%C3%A1lido");
    }

    const dbPlan = await prisma.plan.findUnique({ where: { code: planCode }, select: { id: true } });
    if (!dbPlan) {
      redirect("/account/plan?error=Plan%20no%20encontrado");
    }

    // Create payment (mock) and activate license atomically.
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          userId: user.id,
          planCode: planCode,
          amount: price.amount as any,
          currency: price.currency,
          status: "paid",
          provider: "mock",
        },
      });

      await tx.license.updateMany({ where: { userId: user.id, active: true }, data: { active: false } });

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await tx.license.create({
        data: {
          userId: user.id,
          planId: dbPlan.id,
          startsAt: now,
          expiresAt,
          active: true,
          status: "ACTIVE",
        },
      });
    });

    redirect("/account/plan?ok=Suscripci%C3%B3n%20activada");
  }

  return (
    <MobileShell brand="friopro" title="Checkout" userLabel={user.email} active="home">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Plan seleccionado</div>
        <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-3 text-sm">
          <div className="font-medium text-zinc-900">{plan}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {price.amount} {price.currency} / mes
          </div>
        </div>

        <div className="mt-4 text-sm text-zinc-700">
          Método de pago: <span className="font-medium">MOCK</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          En fase 1 simulamos un pago exitoso para habilitar funcionalidades.
        </div>

        <form action={confirmPayment} className="mt-4 grid gap-3">
          <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
            Confirmar pago
          </button>
          <Link href="/account/plan" className="text-center text-sm underline">
            Volver
          </Link>
        </form>
      </div>
    </MobileShell>
  );
}
