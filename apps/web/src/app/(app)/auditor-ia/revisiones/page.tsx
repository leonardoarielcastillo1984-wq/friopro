'use client';
// ============================================================
// Auditor IA — Historial de revisiones (P3)
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, History } from 'lucide-react';
import { listReviews, L, type ReviewSummary } from '../_lib/api';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700', PARTIAL: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-rose-100 text-rose-700', CANCELLED: 'bg-slate-100 text-slate-500',
  RUNNING: 'bg-blue-100 text-blue-700', QUEUED: 'bg-slate-100 text-slate-600',
  DRAFT: 'bg-slate-100 text-slate-600',
};

export default function RevisionesPage() {
  const [items, setItems] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const q = statusFilter ? `?status=${statusFilter}&limit=100` : '?limit=100';
    listReviews(q).then((r) => {
      setItems(r.items ?? []);
      setLoading(false);
    });
  }, [statusFilter]);

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Historial de revisiones</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(L.reviewStatus).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <History className="mx-auto h-8 w-8 text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-600">No hay revisiones con este filtro.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Norma</th>
                <th className="px-4 py-2.5">Período</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Creada</th>
                <th className="px-4 py-2.5">Tokens</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-violet-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/auditor-ia/revisiones/${r.id}`} className="font-medium text-neutral-900 hover:text-violet-700">
                      {r.extraction?.normative.name ?? '—'}
                    </Link>
                    <div className="text-[11px] text-neutral-400">{r.extraction?.normative.code} {r.extraction?.normative.version}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {r.periodFrom ? new Date(r.periodFrom).toLocaleDateString('es-AR') : '—'} →{' '}
                    {r.periodTo ? new Date(r.periodTo).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[r.status] ?? STATUS_COLOR.DRAFT}`}>
                      {L.reviewStatus[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 text-neutral-500">{r.usedTokens ? r.usedTokens.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/auditor-ia/revisiones/${r.id}`} className="text-[12px] text-violet-600 hover:underline">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
