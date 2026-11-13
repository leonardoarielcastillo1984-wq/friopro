'use client';
// ============================================================
// Auditor IA — Normas (P2): lista de normas del tenant con su
// extracción más reciente + botón para extraer/ver.
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Loader2, FileSearch, CheckCircle2, AlertTriangle } from 'lucide-react';
import { normas, startExtraction, L, type Norma } from '../_lib/api';

const EXT_COLOR: Record<string, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  EXTRACTING: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  UNREADABLE: 'bg-rose-100 text-rose-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export default function NormasPage() {
  const [items, setItems] = useState<Norma[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await normas();
    setItems(r.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const extracting = items.some((n) => n.extraction?.status === 'EXTRACTING');
  useEffect(() => {
    if (!extracting) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [extracting, load]);

  const handleExtract = async (n: Norma) => {
    setBusy(n.id);
    setError('');
    try {
      await startExtraction(n.id);
      await load();
    } catch (e) {
      const err = e as { error?: string; message?: string; extractionId?: string };
      if (err.extractionId) {
        window.location.href = `/auditor-ia/normas/${n.id}?extraccion=${err.extractionId}`;
        return;
      }
      setError(err.message ?? err.error ?? 'No se pudo iniciar la extracción');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Extracción normativa</h1>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          La IA propone requisitos a partir del PDF de cada norma; la persona los revisa y aprueba
          antes de poder iniciar una revisión.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <BookOpenCheck className="mx-auto h-8 w-8 text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-600 font-medium">No hay normas cargadas</p>
          <p className="text-[13px] text-neutral-400 mt-1">
            Cargá una norma en <Link href="/cumplimiento" className="text-violet-600 hover:underline">Normativos</Link> primero.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((n) => {
            const ext = n.extraction;
            return (
              <div key={n.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {n.name} <span className="font-normal text-neutral-400">{n.version}</span>
                    </div>
                    <div className="text-[12px] text-neutral-500 mt-0.5">
                      {n.code} · {n.hasPdf ? 'PDF cargado' : 'sin PDF'}
                      {n.totalClauses ? ` · ${n.totalClauses} cláusulas` : ''}
                    </div>
                  </div>
                  {ext && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${EXT_COLOR[ext.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {L.extractionStatus[ext.status] ?? ext.status}
                    </span>
                  )}
                </div>

                {ext && (
                  <div className="mt-2 text-[12px] text-neutral-500">
                    rev. {ext.revision} · {ext.requirementCount} requisitos
                    {ext.pageCount ? ` · ${ext.pageCount} págs.` : ''}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {ext && ext.status !== 'EXTRACTING' && (
                    <Link
                      href={`/auditor-ia/normas/${n.id}?extraccion=${ext.id}`}
                      className="flex items-center gap-1 rounded-lg border border-violet-200 px-2.5 py-1.5 text-[12px] font-medium text-violet-700 hover:bg-violet-50"
                    >
                      {ext.status === 'APPROVED' ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Ver requisitos</>
                      ) : (
                        <><FileSearch className="h-3.5 w-3.5" /> Revisar</>
                      )}
                    </Link>
                  )}
                  {n.hasPdf && (!ext || ['REJECTED', 'FAILED', 'UNREADABLE'].includes(ext.status)) && (
                    <button
                      onClick={() => handleExtract(n)}
                      disabled={busy === n.id}
                      className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {busy === n.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {ext ? 'Reintentar extracción' : 'Extraer requisitos'}
                    </button>
                  )}
                  {!n.hasPdf && (
                    <span className="text-[11px] text-neutral-400 self-center">Subí el PDF en Normativos</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
