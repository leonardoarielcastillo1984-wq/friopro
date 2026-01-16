import Link from "next/link";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MobileShell } from "@/app/ui/mobile-shell";

export default async function PaymentsPage() {
  const user = await requireAuth();

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <MobileShell brand="friopro" title="Pagos" userLabel={user.email} active="home">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Historial de pagos</div>
          <div className="text-xs text-zinc-500">Últimos {payments.length}</div>
        </div>
        <Link href="/account/plan" className="text-sm underline">
          Mi plan
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            Sin pagos todavía.
          </div>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{p.planCode}</div>
                  <div className="mt-1 text-xs text-zinc-500">{new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                  {p.status}
                </div>
              </div>
              <div className="mt-3 text-sm text-zinc-700">
                {p.amount.toString()} {p.currency} — {p.provider}
              </div>
            </div>
          ))
        )}
      </div>
    </MobileShell>
  );
}
