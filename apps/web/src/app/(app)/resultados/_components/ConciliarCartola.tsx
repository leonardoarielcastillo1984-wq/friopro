'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, Landmark } from 'lucide-react';
import { fmtMoney, fmtFecha } from './fmt';

type Fila = { fecha: string; descripcion: string; monto: number; referencia: string | null };
type FilaResp = Fila & {
  idx: number; estado: 'match' | 'sin_match' | 'ya_aplicado'; como?: string; confianza?: 'alta' | 'media' | 'baja';
  excedente?: number; motivo?: string; firma?: string; facturas: { id: string; numero: string | null; cliente: string; aplicar: number; saldoPrevio: number }[];
};
type CargoResp = Fila & {
  idx: number; estado: 'match' | 'sin_match' | 'ya_aplicado'; como?: string; confianza?: 'alta' | 'media' | 'baja';
  motivo?: string; firma?: string; gastos: { id: string; numero: string | null; proveedor: string; aplicar: number; saldoPrevio: number }[];
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

// Detecta columnas: fecha, descripción, abono, cargo (o monto único con signo), referencia.
// Devuelve abonos (plata que entra → cobros de facturas) y cargos (plata que
// sale → pagos de gastos/proveedores).
function filasDeTabla(rows: any[][]): { abonos: Fila[]; cargos: Fila[] } {
  if (rows.length < 2) return { abonos: [], cargos: [] };
  // buscar la fila de encabezados (algunas cartolas traen títulos arriba)
  let hIdx = -1, h: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cand = rows[i].map((c: any) => norm(String(c ?? '')));
    if (cand.some(x => x.includes('fecha')) && (cand.some(x => x.includes('abono') || x.includes('credito') || x.includes('cargo') || x.includes('debito') || x === 'monto') )) { hIdx = i; h = cand; break; }
  }
  if (hIdx < 0) return { abonos: [], cargos: [] };
  const find = (...preds: ((x: string) => boolean)[]) => { for (const p of preds) { const i = h.findIndex(p); if (i >= 0) return i; } return -1; };
  // Formato Santander: columna "CARGO/ABONO" con letra C/A (no es un monto) — el monto con signo va en MONTO
  const flagCol = find(x => x.includes('cargo') && x.includes('abono'));
  const idx = {
    fecha: find(x => x === 'fecha' || x.startsWith('fecha')),
    desc: find(x => x.includes('descripcion') || x.includes('glosa') || x.includes('detalle') || x.includes('motivo') || x.includes('nombre') || x.includes('origen')),
    abono: find(x => (x.includes('abono') || x.includes('credito') || x.includes('haber') || x.includes('deposito')) && !(x.includes('cargo') && x.includes('abono'))),
    cargo: find(x => (x.includes('cargo') || x.includes('debito') || x.includes('debe') || x.includes('giro') || x.includes('pago')) && !(x.includes('cargo') && x.includes('abono'))),
    monto: find(x => x === 'monto' || x === 'valor'),
    // "N° MOVIMIENTO" (único por operación) antes que "N° DOCUMENTO" (suele venir en ceros)
    ref: find(x => x.startsWith('n') && x.includes('movimiento'), x => x.includes('referencia') || x.includes('documento') || x.includes('comprobante')),
  };
  if (idx.fecha < 0 || (idx.abono < 0 && idx.cargo < 0 && idx.monto < 0)) return { abonos: [], cargos: [] };
  const abonos: Fila[] = []; const cargos: Fila[] = [];
  for (const r of rows.slice(hIdx + 1)) {
    const fecha = parseFecha(r[idx.fecha]);
    if (!fecha) continue;
    const fila = (monto: number): Fila => ({
      fecha, monto,
      descripcion: idx.desc >= 0 ? String(r[idx.desc] ?? '').slice(0, 300) : '',
      referencia: idx.ref >= 0 ? (String(r[idx.ref] ?? '').trim() || null) : null,
    });
    if (flagCol >= 0 && idx.monto >= 0) {
      // Formato con flag CARGO/ABONO (Santander): la letra decide el sentido.
      const f = String(r[flagCol] ?? '').trim().toUpperCase();
      const v = Math.abs(parseMonto(r[idx.monto]));
      if (v <= 0) continue;
      if (f ? f.startsWith('A') : parseMonto(r[idx.monto]) > 0) abonos.push(fila(v));
      else cargos.push(fila(v));
      continue;
    }
    const mAbono = idx.abono >= 0 ? parseMonto(r[idx.abono]) : 0;
    const mCargo = idx.cargo >= 0 ? parseMonto(r[idx.cargo]) : 0;
    if (mAbono > 0) { abonos.push(fila(Math.abs(mAbono))); continue; }
    if (mCargo > 0) { cargos.push(fila(Math.abs(mCargo))); continue; }
    if (idx.monto >= 0) {
      const v = parseMonto(r[idx.monto]);
      if (v > 0) abonos.push(fila(v));
      else if (v < 0) cargos.push(fila(Math.abs(v)));
    }
  }
  return { abonos, cargos };
}

async function leerArchivo(file: File): Promise<{ abonos: Fila[]; cargos: Fila[] }> {
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
export default function ConciliarCartola({ moneda, origen = 'CARTOLA', onClose, onDone }: { moneda: string; origen?: 'CARTOLA' | 'CAJA_CHICA'; onClose: () => void; onDone: () => void }) {
  const esCaja = origen === 'CAJA_CHICA';
  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargos, setCargos] = useState<Fila[]>([]);
  const [preview, setPreview] = useState<{ filas: FilaResp[]; cargos?: CargoResp[]; resumen: any } | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = async (file: File) => {
    setError(null); setPreview(null); setResultado(null); setArchivo(file.name); setBusy('parse');
    try {
      const { abonos, cargos: cs } = await leerArchivo(file);
      if (!abonos.length && !cs.length) { setError('No encontré movimientos en el archivo. Revisá que tenga columnas Fecha / Abono / Cargo (o Monto con signo).'); return; }
      setFilas(abonos); setCargos(cs);
      setBusy('analizar');
      const r = await apiFetch<any>('/finanzas/cartola-conciliar', { method: 'POST', json: { commit: false, moneda, origen, filas: abonos, cargos: cs } });
      setPreview(r);
    } catch (e: any) { setError(e?.message || 'No se pudo leer el archivo'); }
    finally { setBusy(null); }
  };

  const aplicar = async () => {
    setBusy('commit'); setError(null);
    try {
      const r = await apiFetch<any>('/finanzas/cartola-conciliar', { method: 'POST', json: { commit: true, moneda, origen, filas, cargos } });
      setResultado(r); onDone();
    } catch (e: any) { setError(e?.message || 'Error al registrar los cobros'); }
    finally { setBusy(null); }
  };

  const deshacer = async (firma: string) => {
    if (!confirm('¿Deshacer esta conciliación? Se eliminan los cobros registrados por ese abono y las facturas vuelven a pendiente.')) return;
    setBusy('commit'); setError(null);
    try {
      await apiFetch('/finanzas/cartola-deshacer', { method: 'POST', json: { referencia: firma } });
      const r = await apiFetch<any>('/finanzas/cartola-conciliar', { method: 'POST', json: { commit: false, moneda, origen, filas, cargos } });
      setPreview(r); onDone();
    } catch (e: any) { setError(e?.message || 'Error al deshacer'); }
    finally { setBusy(null); }
  };

  const chip = (f: { estado: string; como?: string; confianza?: string }) => {
    if (f.estado === 'ya_aplicado') return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">ya aplicado</span>;
    if (f.estado === 'sin_match') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">sin match</span>;
    const col = f.confianza === 'alta' ? 'bg-emerald-100 text-emerald-700' : f.confianza === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';
    const lbl = f.como === 'folio' ? 'por folio' : f.como === 'rut' ? 'por RUT' : f.como === 'nombre' ? 'por nombre' : 'por monto';
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${col}`}>{lbl}{f.confianza !== 'alta' ? ` (${f.confianza})` : ''}</span>;
  };

  const nMatch = (preview?.resumen?.matches ?? 0) + (preview?.resumen?.cargosMatch ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3.5">
          <Landmark size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-neutral-900">{esCaja ? 'Conciliar caja chica' : 'Conciliar cartola bancaria'}</h2>
          <button onClick={onClose} className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {!resultado && (
            <>
              <p className="mb-3 text-xs text-neutral-500">
                {esCaja
                  ? <>Subí el registro de caja chica (Excel o CSV). Los <b>abonos</b> (reposiciones de fondo) se cruzan con facturas pendientes y los <b>cargos</b> con gastos pendientes — solo se imputa cuando cuadra <b>exactamente</b> el monto, y los pagos quedan con medio <b>CAJA_CHICA</b>. Re-subir no duplica, y lo aplicado se puede <b>deshacer</b>.</>
                  : <>Subí la cartola del banco (Excel o CSV). Los <b>abonos</b> se cruzan con las facturas de clientes pendientes y los <b>cargos</b> con los gastos de proveedores pendientes, por RUT o nombre — solo se imputa cuando un documento (o una combinación) suma <b>exactamente</b> el movimiento, y nunca a documentos emitidos después del pago. Re-subir el mismo archivo no duplica registros, y lo ya aplicado se puede <b>deshacer</b>.</>}
              </p>
              <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-7 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50">
                {busy === 'parse' || busy === 'analizar' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span className="text-sm">{archivo ? <><FileSpreadsheet size={14} className="mr-1 inline" />{archivo} — clic para cambiar</> : esCaja ? 'Subir caja chica (.xlsx, .xls, .csv)' : 'Subir cartola (.xlsx, .xls, .csv)'}</span>
                {busy === 'analizar' && <span className="text-xs">Cruzando con facturas y gastos pendientes…</span>}
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
                {(preview.resumen.cargosTotal ?? 0) > 0 && <>
                  <span className="text-neutral-300">|</span>
                  <span><b>{preview.resumen.cargosTotal}</b> cargos</span>
                  <span className="text-emerald-700"><b>{preview.resumen.cargosMatch}</b> con match ({fmtMoney(preview.resumen.cargosMontoMatch ?? 0, moneda)})</span>
                  {preview.resumen.cargosSinMatch > 0 && <span className="text-red-600"><b>{preview.resumen.cargosSinMatch}</b> sin match</span>}
                  {preview.resumen.cargosYaAplicados > 0 && <span><b>{preview.resumen.cargosYaAplicados}</b> ya aplicados antes</span>}
                </>}
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
                      <tr key={`a-${f.idx}`} className={`border-t border-neutral-100 ${f.estado === 'sin_match' ? 'bg-red-50/40' : f.estado === 'ya_aplicado' ? 'opacity-50' : ''}`}>
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
                          {f.estado === 'sin_match' && f.motivo ? <div className="max-w-56 text-neutral-400" title={f.motivo}>{f.motivo}</div> : null}
                          {f.estado === 'ya_aplicado' && f.firma ? (
                            <button onClick={() => deshacer(f.firma!)} disabled={!!busy} title="Elimina los cobros registrados por este abono"
                              className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600">deshacer</button>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5">{chip(f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(preview.cargos?.length ?? 0) > 0 && (
                <>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Cargos → pagos a proveedores</div>
                  <div className="mt-1 max-h-80 overflow-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-neutral-50">
                        <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                          <th className="px-3 py-2 font-medium">Fecha</th><th className="px-3 py-2 font-medium">Descripción</th>
                          <th className="px-3 py-2 text-right font-medium">Monto</th><th className="px-3 py-2 font-medium">Match</th><th className="px-3 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.cargos!.map((f: CargoResp) => (
                          <tr key={`c-${f.idx}`} className={`border-t border-neutral-100 ${f.estado === 'sin_match' ? 'bg-red-50/40' : f.estado === 'ya_aplicado' ? 'opacity-50' : ''}`}>
                            <td className="px-3 py-1.5 text-xs text-neutral-500 whitespace-nowrap">{fmtFecha(f.fecha + 'T12:00:00')}</td>
                            <td className="px-3 py-1.5 text-xs"><div className="max-w-56 truncate" title={f.descripcion}>{f.descripcion || '—'}</div></td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{fmtMoney(f.monto, moneda)}</td>
                            <td className="px-3 py-1.5 text-xs">
                              {(f.gastos || []).map(a => (
                                <div key={a.id} className="whitespace-nowrap">
                                  {a.numero ? `#${a.numero} ` : ''}<span className="text-neutral-400">({a.proveedor})</span> → <b>{fmtMoney(a.aplicar, moneda)}</b>
                                </div>
                              ))}
                              {f.estado === 'sin_match' && f.motivo ? <div className="max-w-56 text-neutral-400" title={f.motivo}>{f.motivo}</div> : null}
                              {f.estado === 'ya_aplicado' && f.firma ? (
                                <button onClick={() => deshacer(f.firma!)} disabled={!!busy} title="Elimina los pagos registrados por este cargo"
                                  className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600">deshacer</button>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5">{chip(f)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {resultado && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Conciliación aplicada</div>
              <div className="mt-1">
                {resultado.creados} cobros registrados sobre {resultado.facturasAfectadas} facturas
                {resultado.pagosCreados ? ` · ${resultado.pagosCreados} pagos registrados sobre ${resultado.gastosAfectados} gastos` : ''}
                {resultado.errores?.length ? ` · ${resultado.errores.length} errores` : ''}
              </div>
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
                Registrar {nMatch} movimiento{nMatch === 1 ? '' : 's'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
