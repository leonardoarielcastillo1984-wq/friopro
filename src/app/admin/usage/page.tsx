import { prisma } from "@/lib/prisma";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const now = new Date();
  const monthParam = (searchParams?.month ?? "").trim();
  const monthDate = monthParam ? new Date(monthParam + "-01") : now;
  const from = startOfMonth(monthDate);
  const to = endOfMonth(monthDate);

  const events = await prisma.usageEvent.findMany({
    where: {
      createdAt: { gte: from, lt: to },
    },
    include: {
      license: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
    take: 5000,
  });

  const byUser: Record<
    string,
    { name: string; email: string; workorders: number; pdfs: number; ai: number }
  > = {};

  for (const e of events) {
    const u = e.license.user;
    const key = u.id;
    if (!byUser[key]) {
      byUser[key] = { name: u.name, email: u.email, workorders: 0, pdfs: 0, ai: 0 };
    }
    if (e.type === "WORKORDER_CREATED") byUser[key].workorders += 1;
    if (e.type === "PDF_GENERATED") byUser[key].pdfs += 1;
    if (e.type === "AI_CALL") byUser[key].ai += 1;
  }

  const rows = Object.entries(byUser)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (b.workorders + b.pdfs + b.ai) - (a.workorders + a.pdfs + a.ai));

  const monthValue = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Uso</h1>
        <p className="mt-1 text-sm text-zinc-600">Consumo mensual por usuario.</p>

        <form className="mt-4 flex gap-2" action="/admin/usage" method="get">
          <input
            name="month"
            type="month"
            defaultValue={monthValue}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          />
          <button className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Ver
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">WorkOrders</th>
                <th className="px-4 py-3">PDFs</th>
                <th className="px-4 py-3">IA</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-zinc-100">
                  <td className="px-4 py-4 text-sm text-zinc-600" colSpan={4}>
                    Sin eventos en el período.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{r.name}</div>
                      <div className="text-xs text-zinc-500">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{r.workorders}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.pdfs}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.ai}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
