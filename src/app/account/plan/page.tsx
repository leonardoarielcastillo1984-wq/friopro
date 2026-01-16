import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { getAccessState } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";
import { TrialExpiredModal } from "@/app/ui/trial-expired-modal";

function PlanCard({
  title,
  price,
  bullets,
  isCurrent,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  price: string;
  bullets: string[];
  isCurrent: boolean;
  ctaLabel: string;
  ctaHref: string | null;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">{price}</div>
        </div>
        {isCurrent ? (
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Plan actual
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-1 text-sm text-zinc-700">
        {bullets.map((b) => (
          <div key={b}>- {b}</div>
        ))}
      </div>

      <div className="mt-4">
        {ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            disabled
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-200 px-6 text-sm font-medium text-zinc-600"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default async function AccountPlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const sp = (await searchParams) ?? {};
  const ok = (sp.ok ?? "").trim();
  const error = (sp.error ?? "").trim();

  const [access, plans] = await Promise.all([
    getAccessState(user.id),
    prisma.plan.findMany({ orderBy: { maxWorkOrdersPerMonth: "asc" } }),
  ]);

  const currentPlanCode = access.mode === "FULL" ? access.planCode : access.planCode ?? "FREE";

  const overlay =
    access.mode === "READ_ONLY" && access.reason === "TRIAL_EXPIRED" ? (
      <TrialExpiredModal message="Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro." />
    ) : undefined;

  const freeBullets = [
    "Máximo 2 clientes",
    "Máximo 2 equipos",
    "Órdenes básicas",
    "Sin PDF",
    "Sin QR público",
    "Sin recordatorios",
    "Sin IA",
  ];
  const proBullets = [
    "Clientes ilimitados",
    "Equipos ilimitados",
    "Órdenes ilimitadas",
    "PDF profesional (20/mes)",
    "QR básico del equipo",
    "Historial completo",
    "Estadísticas",
    "Sin recordatorios",
    "Sin IA",
  ];
  const proPlusBullets = [
    "Todo lo del PRO",
    "PDFs (50/mes)",
    "QR público con historial",
    "Planificación de mantenimiento",
    "Recordatorios automáticos (email + mensaje)",
    "IA asistida (10/mes)",
  ];

  const prices: Record<string, string> = {
    FREE: "$0",
    PRO: "$9.000 / mes (mock)",
    PRO_PLUS: "$15.000 / mes (mock)",
  };

  return (
    <MobileShell brand="friopro" title="Mi plan" userLabel={user.email} active="home" overlay={overlay}>
      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {currentPlanCode === "FREE" && access.trial ? (
        <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">Prueba gratuita</div>
          <div className="mt-2 text-sm text-zinc-600">
            {access.trial.daysRemaining > 0
              ? `Te quedan ${access.trial.daysRemaining} días.`
              : "Tu prueba finalizó."}
          </div>
          <div className="mt-3">
            <Link
              href="/checkout?plan=PRO"
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Actualizar plan
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Uso mensual</div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">OTs</div>
            <div className="mt-1 font-medium text-zinc-900">
              {access.mode === "FULL" ? access.usage.workorders : 0}
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">PDFs</div>
            <div className="mt-1 font-medium text-zinc-900">
              {access.mode === "FULL" ? access.usage.pdfs : 0}
            </div>
          </div>
          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
            <div className="text-xs text-zinc-500">IA</div>
            <div className="mt-1 font-medium text-zinc-900">
              {access.mode === "FULL" ? access.usage.ai : 0}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          El consumo se calcula por mes calendario.
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <PlanCard
          title="FREE"
          price={prices.FREE}
          bullets={freeBullets}
          isCurrent={currentPlanCode === "FREE"}
          ctaLabel={currentPlanCode === "FREE" ? "Plan actual" : "Cambiar a FREE"}
          ctaHref={currentPlanCode === "FREE" ? null : "/checkout?plan=FREE"}
        />

        <PlanCard
          title="PRO"
          price={prices.PRO}
          bullets={proBullets}
          isCurrent={currentPlanCode === "PRO"}
          ctaLabel={currentPlanCode === "PRO" ? "Plan actual" : "Actualizar a PRO"}
          ctaHref={currentPlanCode === "PRO" ? null : "/checkout?plan=PRO"}
        />

        <PlanCard
          title="PRO_PLUS"
          price={prices.PRO_PLUS}
          bullets={proPlusBullets}
          isCurrent={currentPlanCode === "PRO_PLUS"}
          ctaLabel={currentPlanCode === "PRO_PLUS" ? "Plan actual" : "Actualizar a PRO+"}
          ctaHref={currentPlanCode === "PRO_PLUS" ? null : "/checkout?plan=PRO_PLUS"}
        />
      </div>

      <div className="mt-4">
        <Link href="/payments" className="inline-block text-sm underline">
          Ver historial de pagos
        </Link>
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Integración de pago real (Stripe/MercadoPago) preparada a futuro. Hoy el checkout es mock.
      </div>

      {/* keep reference to plans so Prisma model stays in use */}
      <div className="hidden">{plans.length}</div>
    </MobileShell>
  );
}
