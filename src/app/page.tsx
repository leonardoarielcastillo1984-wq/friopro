import Link from "next/link";

import { getCurrentUser } from "@/lib/auth-helpers";
import { getAccessState } from "@/lib/access";
import { SignOutButton } from "@/app/home-auth-actions";
import { MobileShell } from "@/app/ui/mobile-shell";
import { TrialExpiredModal } from "@/app/ui/trial-expired-modal";

export default async function Home() {
  const user = await getCurrentUser();

  const title = user ? `Hola, ${user.name || user.email}` : "Bienvenido";
  const userLabel = user ? `${user.email} (${user.role})` : undefined;

  const access = user?.id ? await getAccessState(user.id) : null;

  const overlay =
    access && access.mode === "READ_ONLY" && access.reason === "TRIAL_EXPIRED" ? (
      <TrialExpiredModal message="Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro." />
    ) : undefined;

  return (
    <MobileShell
      brand="friopro"
      title={title}
      userLabel={userLabel}
      active="home"
      overlay={overlay}
    >
      {user ? (
        <div className="grid grid-cols-1 gap-3">
          <LicenseCard access={access} />
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="OTs (mes)" value={access && access.mode === "FULL" ? access.usage.workorders : 0} />
            <KpiCard label="PDFs (mes)" value={access && access.mode === "FULL" ? access.usage.pdfs : 0} />
            <KpiCard label="IA (mes)" value={access && access.mode === "FULL" ? access.usage.ai : 0} />
            <KpiCard label="Estado" value={access ? (access.mode === "FULL" ? "OK" : "Bloq") : "—"} />
          </div>
        </div>
      ) : (
        <HeroCard />
      )}

      <div className="mt-4">
        <HomeBanner user={user} access={access} />
      </div>

      <div className="mt-4">
        <HomeActions user={user} />
      </div>
    </MobileShell>
  );
}

function HomeActions({
  user,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}) {
  if (!user) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/register"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
        >
          Registrarse
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {user.role === "SUPER_ADMIN" ? (
        <Link
          href="/admin"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Administración
        </Link>
      ) : (
        <Link
          href="/workorders"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          Órdenes
        </Link>
      )}

      <SignOutButton className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50" />
    </div>
  );
}

function HomeBanner({
  user,
  access,
}: {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  access: Awaited<ReturnType<typeof getAccessState>> | null;
}) {
  if (!user) return null;
  if (user.role === "SUPER_ADMIN") return null;
  if (!access) return null;

  if (access.mode === "FULL") {
    const trialLine =
      access.planCode === "FREE" && access.trial
        ? ` Prueba: ${access.trial.daysRemaining} días restantes.`
        : "";
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Licencia activa: {access.planCode} — {access.planName}. OTs {access.usage.workorders}/
        {access.limits.maxWorkOrdersPerMonth}.{trialLine}{" "}
        <Link href="/account/plan" className="underline">
          Actualizar plan
        </Link>
      </div>
    );
  }

  const message =
    access.reason === "NO_LICENSE"
      ? "No tenés licencia asignada. Modo solo lectura."
      : access.reason === "LICENSE_SUSPENDED"
        ? "Tu licencia está suspendida. Modo solo lectura."
        : access.reason === "LICENSE_EXPIRED"
          ? "Tu licencia está vencida. Modo solo lectura."
          : access.reason === "WORKORDERS_LIMIT_REACHED"
            ? `Límite mensual de OTs alcanzado (${access.details}). Modo solo lectura.`
            : access.reason === "TRIAL_EXPIRED"
              ? "Tu prueba gratuita finalizó. Actualizá tu plan para continuar usando FríoPro."
              : "Modo solo lectura.";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div>{message}</div>
      <div className="mt-2">
        <Link href="/account/plan" className="text-sm underline">
          Actualizar plan
        </Link>
      </div>
    </div>
  );
}

function HeroCard() {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">FríoPro</div>
      <div className="mt-1 text-sm text-zinc-600">
        Caja Negra del Técnico — Órdenes, mediciones, evidencia, PDF y QR
      </div>
    </div>
  );
}

function LicenseCard({
  access,
}: {
  access: Awaited<ReturnType<typeof getAccessState>> | null;
}) {
  const title =
    access?.mode === "FULL"
      ? `Tu licencia, ${access.planCode}`
      : "Tu licencia";

  const subtitle =
    access?.mode === "FULL" ? access.planName : "Modo solo lectura";

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-700 p-4 text-white shadow-sm">
      <div className="text-xs opacity-90">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{subtitle}</div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs opacity-90">Estado</div>
        <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
          {access?.mode === "FULL" ? "Activa" : "Solo lectura"}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
