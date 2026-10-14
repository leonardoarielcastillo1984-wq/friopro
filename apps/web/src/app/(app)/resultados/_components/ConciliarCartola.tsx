'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, Landmark } from 'lucide-react';
import { fmtMoney, fmtFecha } from './fmt';

type Fila = { fecha: string; descripcion: string; monto: number; referencia: string | null };
type FilaResp = Fila & {
  idx: number; estado: 'match' | 'sin_match' | 'ya_aplicado'; como?: string; confianza?: 'alta' | 'media' | 'baja';
  excedente?: number; facturas: { id: string; numero: string | null; cliente: string; aplicar: number; saldoPrevio: number }[];
};

// ── Parseo de cartola (CSV/TXT/Excel) ───────────────────────────────────────
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const parseMonto = (v: any): number => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  // "1.234.567" o "1.234.567,89" (formato chileno) vs "1,234,567.89" o "1234.56"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

const parseFecha = (v: any): string => {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (v == null) return '';
  const s = String(v).trim().split(' ')[0];
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);           // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                          // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);               // dd/mm/yy
  if (m) return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

const splitLinea = (line: string, sep: string) => {
  const out: string[] = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
};

// Detecta columnas: fecha, descripción, abono (o monto único con signo), referencia.
// Los cargos/débitos se ignoran — solo se concilian ABONOS (plata que entra).
function filasDeTabla(rows: any[][]): Fila[] {
  if (rows.length < 2) return [];
  // buscar la fila de encabezados (algunas cartolas traen títulos arriba)
  let hIdx = -1, h: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cand = rows[i].map((c: any) => norm(String(c ?? '')));
    if (cand.some(x => x.includes('fecha')) && (cand.some(x => x.includes('abono') || x.includes('credito') || x === 'monto') )) { hIdx = i; h = cand; break; }
  }
  if (hIdx < 0) return [];
  const find = (...preds: ((x: string) => boolean)[]) => { for (const p of preds) { const i = h.findIndex(p); if (i >= 0) return i; } return -1; };
  // Formato Santander: columna "CARGO/ABONO" con letra C/A (no es un monto) — el monto con signo va en MONTO
  const flagCol = find(x => x.includes('cargo') && x.includes('abono'));
  const idx = {
    fecha: find(x => x === 'fecha' || x.startsWith('fecha')),
    desc: find(x => x.includes('descripcion') || x.includes('glosa') || x.includes('detalle') || x.includes('motivo') || x.includes('nombre') || x.includes('origen')),
    abono: find(x => (x.includes('abono') || x.includes('credito') || x.includes('haber') || x.includes('deposito')) && !(x.includes('cargo') && x.includes('abono'))),
    monto: find(x => x === 'monto' || x === 'valor'),
    // "N° MOVIMIENTO" (único por operación) antes que "N° DOCUMENTO" (suele venir en ceros)
    ref: find(x => x.startsWith('n') && x.includes('movimiento'), x => x.includes('referencia') || x.includes('documento') || x.includes('comprobante')),
  };
  if (idx.fecha < 0 || (idx.abono < 0 && idx.monto < 0)) return [];
  const out: Fila[] = [];
  for (const r of rows.slice(hIdx + 1)) {
    const fecha = parseFecha(r[idx.fecha]);
    if (!fecha) continue;
    let monto = 0;
    if (flagCol >= 0 && idx.monto >= 0) {
      const f = String(r[flagCol] ?? '').trim().toUpperCase();
      const v = parseMonto(r[idx.monto]);
      if (f ? !f.startsWith('A') : v <= 0) continue;   // solo abonos
      monto = Math.abs(v);
    } else {
      monto = parseMonto(idx.abono >= 0 ? r[idx.abono] : r[idx.monto]);
    }
    if (monto <= 0) continue;
    out.push({
      fecha, monto,
      descripcion: idx.desc >= 0 ? String(r[idx.desc] ?? '').slice(0, 300) : '',
      referencia: idx.ref >= 0 ? (String(r[idx.ref] ?? '').trim() || null) : null,
    });
  }
  return out;
}

async function leerArchivo(file: File): Promise<Fila[]> {
  const buf = await file.arrayBuffer();
  if (/\.(xlsx?|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return filasDeTabla(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]);
  }
  let texto: string;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { texto = new TextDecoder('windows-1252').decode(buf); }
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  const sep = lineas[0]?.includes('\t') ? '\t' : (lineas[0]?.match(/;/g) || []).length >= (lineas[0]?.match(/,/g) || []).length ? ';' : ',';
  return filasDeTabla(lineas.map(l => splitLinea(l, sep)));
}

// ── Modal ──────────────────────────────────────────────────────────────────
export default function ConciliarCartola({ moneda, onClose, onDone }: { moneda: string; onClose: () => void; onDone: () => void }) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [preview, setPreview] = useState<{ filas: FilaResp[]; resumen: any } | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = async (file: File) => {
    setError(null); setPreview(null); setResultado(null); setArchivo(file.name); setBusy('parse');
    try {
      const f = await leerArchivo(file);
      if (!f.length) { setError('No encontré abonos en el archivo. Revisá que tenga columnas Fecha / Abono (o Monto positivo).'); return; }
      setFilas(f);
      setBusy('analizar');
      const r = await apiFetch<any>('/finanzas/cartola-conciliar', { method: 'POST', json: { commit: false, moneda, filas: f } });
      setPreview(r);
    } catch (e: any) { setError(e?.message || 'No se pudo leer el archivo'); }
    finally { setBusy(null); }
  };

  const aplicar = async () => {
    setBusy('commit'); setError(null);
    try {
      const r = await apiFetch<any>('/finanzas/cartola-conciliar', { method: 'POST', json: { commit: true, moneda, filas } });
      setResultado(r); onDone();
    } catch (e: any) { setError(e?.message || 'Error al registrar los cobros'); }
    finally { setBusy(null); }
  };

  const chip = (f: FilaResp) => {
    if (f.estado === 'ya_aplicado') return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">ya aplicado</span>;
    if (f.estado === 'sin_match') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">sin match</span>;
    const col = f.confianza === 'alta' ? 'bg-emerald-100 text-emerald-700' : f.confianza === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';
    const lbl = f.como === 'rut' ? 'por RUT' : f.como === 'nombre' ? 'por nombre' : 'por monto';
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${col}`}>{lbl}{f.confianza !== 'alta' ? ` (${f.confianza})` : ''}</span>;
  };

  const nMatch = preview?.resumen?.matches ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3.5">
          <Landmark size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Conciliar cartola bancaria</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {!resultado && (
            <>
              <p className="mb-3 text-xs text-neutral-500">
                Subí la cartola del banco (Excel o CSV). Se toman solo los <b>abonos</b> y se cruzan con las facturas pendientes por RUT, nombre del cliente o monto exacto. Re-subir el mismo archivo no duplica cobros.
              </p>
              <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-7 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50">
                {busy === 'parse' || busy === 'analizar' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span className="text-sm">{archivo ? <><FileSpreadsheet size={14} className="mr-1 inline" />{archivo} — clic para cambiar</> : 'Subir cartola (.xlsx, .xls, .csv)'}</span>
                {busy === 'analizar' && <span className="text-xs">Cruzando con facturas pendientes…</span>}
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" className="hidden" onChange={e => { if (e.target.files?.[0]) cargar(e.target.files[0]); e.target.value = ''; }} />
            </>
          )}

          {error && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</div>}

          {preview && !resultado && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <span><b>{preview.resumen.total}</b> abonos</span>
                <span className="text-emerald-700"><b>{preview.resumen.matches}</b> con match ({fmtMoney(preview.resumen.montoMatch, moneda)})</span>
                {preview.resumen.sinMatch > 0 && <span className="text-red-600"><b>{preview.resumen.sinMatch}</b> sin match</span>}
                {preview.resumen.yaAplicados > 0 && <span><b>{preview.resumen.yaAplicados}</b> ya aplicados antes</span>}
              </div>
              <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-50">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                      <th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Descripción</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th><th className="px-3 py-2 font-medium">Match</th><th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas.map((f: FilaResp) => (
                      <tr key={f.idx} className={`border-t border-neutral-100 ${f.estado === 'sin_match' ? 'bg-red-50/40' : f.estado === 'ya_aplicado' ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-1.5 text-xs text-neutral-500 whitespace-nowrap">{fmtFecha(f.fecha + 'T12:00:00')}</td>
                        <td className="px-3 py-1.5 text-xs"><div className="max-w-56 truncate" title={f.descripcion}>{f.descripcion || '—'}</div></td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtMoney(f.monto, moneda)}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {f.facturas.map(a => (
                            <div key={a.id} className="whitespace-nowrap">
                              F{a.numero || 's/n'} <span className="text-neutral-400">({a.cliente})</span> → <b>{fmtMoney(a.aplicar, moneda)}</b>
                            </div>
                          ))}
                          {f.excedente ? <div className="text-amber-600">excedente {fmtMoney(f.excedente, moneda)}</div> : null}
                        </td>
                        <td className="px-3 py-1.5">{chip(f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {resultado && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Conciliación aplicada</div>
              <div className="mt-1">{resultado.creados} cobros registrados sobre {resultado.facturasAfectadas} facturas{resultado.errores?.length ? ` · ${resultado.errores.length} errores` : ''}</div>
              {resultado.errores?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-700">{resultado.errores.slice(0, 8).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          {resultado ? (
            <button onClick={onClose} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Cerrar</button>
          ) : (
            <>
              <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">Cancelar</button>
              <button onClick={aplicar} disabled={!nMatch || busy === 'commit'}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busy === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Registrar {nMatch} cobro{nMatch === 1 ? '' : 's'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
