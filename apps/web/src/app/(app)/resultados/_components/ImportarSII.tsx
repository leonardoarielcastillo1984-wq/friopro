'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet, Info } from 'lucide-react';
import { fmtMoney, fmtFecha, CATEGORIA_GASTO, MONEDAS } from './fmt';

type Fila = {
  tipoDoc: string; folio: string; rut: string | null; razonSocial: string | null; fecha: string;
  exento: number; neto: number; iva: number; ivaNoRecuperable: number; total: number;
};

// Normaliza encabezados: minúsculas, sin acentos ni símbolos ("Razón Social" → "razon social")
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Montos del RCV vienen como enteros; tolera "1.234.567" o "1234,50" si se pasó por Excel
const parseMonto = (v: string | undefined) => {
  if (!v) return 0;
  let s = v.trim().replace(/[^\d,.-]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

const parseFecha = (v: string | undefined) => {
  if (!v) return '';
  const s = v.trim().split(' ')[0];
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
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

function parseRcv(texto: string): { filas: Fila[]; columnas: Record<string, string>; faltan: string[] } {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!lineas.length) return { filas: [], columnas: {}, faltan: ['archivo vacío'] };
  const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
  const head = splitLinea(lineas[0], sep);
  const h = head.map(norm);
  const find = (pred: (x: string) => boolean) => h.findIndex(pred);
  const idx = {
    tipoDoc: find(x => x.startsWith('tipo doc')),
    folio: find(x => x === 'folio'),
    rut: find(x => x.includes('rut')),
    razon: find(x => x.includes('razon social') || (x.includes('raz') && x.includes('social'))),
    fecha: (() => { const i = find(x => x.includes('fecha docto')); return i >= 0 ? i : find(x => x.startsWith('fecha')); })(),
    exento: find(x => x.includes('monto exento')),
    neto: find(x => x.includes('monto neto')),
    iva: (() => { const i = find(x => x === 'monto iva' || x === 'monto iva recuperable'); return i; })(),
    ivaNoRec: find(x => x.includes('monto iva no recuperable')),
    total: find(x => x.includes('monto total')),
  };
  const columnas: Record<string, string> = {};
  for (const [k, i] of Object.entries(idx)) if (i >= 0) columnas[k] = head[i];
  const requeridas: (keyof typeof idx)[] = ['folio', 'fecha', 'total'];
  const faltan = requeridas.filter(k => idx[k] < 0).map(k => ({ folio: 'Folio', fecha: 'Fecha Docto', total: 'Monto Total' } as any)[k]);
  if (faltan.length) return { filas: [], columnas, faltan };

  const filas: Fila[] = [];
  for (const l of lineas.slice(1)) {
    const c = splitLinea(l, sep);
    const folio = (c[idx.folio] || '').replace(/^0+/, '') || c[idx.folio];
    const fecha = parseFecha(c[idx.fecha]);
    const total = parseMonto(c[idx.total]);
    if (!folio || !fecha || !total) continue;
    filas.push({
      tipoDoc: idx.tipoDoc >= 0 ? (c[idx.tipoDoc] || '33') : '33', folio,
      rut: idx.rut >= 0 ? (c[idx.rut] || null) : null,
      razonSocial: idx.razon >= 0 ? (c[idx.razon] || null) : null, fecha,
      exento: parseMonto(c[idx.exento]), neto: parseMonto(c[idx.neto]), iva: parseMonto(c[idx.iva]),
      ivaNoRecuperable: parseMonto(c[idx.ivaNoRec]), total,
    });
  }
  return { filas, columnas, faltan: [] };
}

async function leerTexto(file: File) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

export default function ImportarSII({ centros, moneda, monedas = MONEDAS, onChanged }: { centros: any[]; moneda: string; monedas?: string[]; onChanged: () => void }) {
  const [tipo, setTipo] = useState<'VENTAS' | 'COMPRAS'>('VENTAS');
  const [mon, setMon] = useState(moneda);
  const [centroCostoId, setCentroCostoId] = useState('');
  const [dias, setDias] = useState('30');
  const [categoria, setCategoria] = useState('OTRO');
  const [tipoGasto, setTipoGasto] = useState('OPERATIVO');
  const [archivo, setArchivo] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ReturnType<typeof parseRcv> | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = async (file: File) => {
    setResultado(null); setError(null);
    setArchivo(file.name);
    const p = parseRcv(await leerTexto(file));
    setParsed(p);
    if (p.faltan.length) setError(`No encontré las columnas: ${p.faltan.join(', ')}. ¿Es el CSV de "Descargar detalles" del RCV?`);
    else if (!p.filas.length) setError('El archivo no tiene filas válidas.');
    // Sugerir tipo según encabezados
    if (p.columnas.rut?.toLowerCase().includes('proveedor')) setTipo('COMPRAS');
    else if (p.columnas.rut?.toLowerCase().includes('cliente')) setTipo('VENTAS');
  };

  const importar = async () => {
    if (!parsed?.filas.length) return;
    setImporting(true); setError(null);
    try {
      let creados = 0, duplicados = 0; const errores: string[] = [];
      for (let i = 0; i < parsed.filas.length; i += 1000) {
        const r = await apiFetch<any>('/finanzas/importar-rcv', {
          method: 'POST',
          json: {
            tipo, moneda: mon, centroCostoId: centroCostoId || null, diasVencimiento: Number(dias) || 0,
            categoriaDefault: categoria, tipoGastoDefault: tipoGasto, filas: parsed.filas.slice(i, i + 1000),
          },
        });
        creados += r.creados; duplicados += r.duplicados; errores.push(...(r.errores || []));
      }
      setResultado({ creados, duplicados, errores });
      onChanged();
    } catch (e: any) { setError(e?.message || 'Error al importar'); }
    finally { setImporting(false); }
  };

  const tot = parsed?.filas.reduce((t, f) => {
    const s = f.tipoDoc.trim() === '61' ? -1 : 1;
    return { neto: t.neto + s * (f.neto + f.exento), iva: t.iva + s * f.iva, total: t.total + s * f.total };
  }, { neto: 0, iva: 0, total: 0 });

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-900">
        <div className="mb-1 flex items-center gap-2 font-semibold"><Info size={15} />Cómo bajar el archivo del SII</div>
        <ol className="ml-5 list-decimal space-y-0.5 text-[13px]">
          <li>Entrá a <b>sii.cl</b> con el RUT de la empresa → <b>Servicios online → Factura electrónica → Registro de Compras y Ventas</b>.</li>
          <li>Elegí el <b>período</b> (mes) y la pestaña <b>Venta</b> (facturas a clientes) o <b>Compra</b> (facturas de proveedores).</li>
          <li>Hacé clic en <b>Descargar detalles</b>: baja un archivo CSV. Subilo acá, un mes por vez o varios.</li>
        </ol>
        <div className="mt-1.5 text-[12px] text-sky-700">Podés volver a subir el mismo mes: las facturas que ya están (mismo folio y RUT) no se duplican.</div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div><label className={labelCls}>Tipo de registro</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as any)} className={inputCls}>
              <option value="VENTAS">Ventas → facturas emitidas</option><option value="COMPRAS">Compras → gastos</option>
            </select></div>
          <div><label className={labelCls}>Moneda</label>
            <select value={mon} onChange={e => setMon(e.target.value)} className={inputCls}>{monedas.map(m => <option key={m}>{m}</option>)}</select></div>
          <div><label className={labelCls}>Unidad / centro de costo</label>
            <select value={centroCostoId} onChange={e => setCentroCostoId(e.target.value)} className={inputCls}>
              <option value="">—</option>{centros.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          {tipo === 'VENTAS' ? (
            <div><label className={labelCls}>Plazo de pago (días)</label><input type="number" value={dias} onChange={e => setDias(e.target.value)} className={inputCls} /></div>
          ) : <>
            <div><label className={labelCls}>Categoría por defecto</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls}>
                {Object.entries(CATEGORIA_GASTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className={labelCls}>Tipo por defecto</label>
              <select value={tipoGasto} onChange={e => setTipoGasto(e.target.value)} className={inputCls}>
                <option value="OPERATIVO">Operativo</option><option value="ESTRUCTURA">Estructura</option><option value="OTRO">Otro</option>
              </select></div>
          </>}
        </div>
        {tipo === 'COMPRAS' && (
          <p className="mt-2 text-xs text-neutral-400">
            Si un proveedor ya fue clasificado antes (Gastos → Clasificar proveedores), se usa su categoría. Después de importar podés reclasificar por proveedor en un clic.
            Ojo: no importes facturas de combustible o talleres que ya cargaste en Flota 360, se contarían dos veces.
          </p>
        )}

        <button onClick={() => fileRef.current?.click()} className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 py-8 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50">
          <Upload size={22} />
          <span className="text-sm">{archivo ? <><FileSpreadsheet size={14} className="mr-1 inline" />{archivo} — clic para cambiar</> : 'Subir CSV del RCV (Descargar detalles)'}</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) cargar(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</div>}

      {resultado && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} />Importación terminada</div>
          <div className="mt-1">{resultado.creados} cargados · {resultado.duplicados} ya existían (no se duplicaron){resultado.errores.length ? ` · ${resultado.errores.length} con error` : ''}</div>
          {resultado.errores.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-700">{resultado.errores.slice(0, 10).map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}

      {parsed && parsed.filas.length > 0 && !resultado && (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-semibold">{parsed.filas.length} documentos detectados</span>
            {tot && <span className="text-xs text-neutral-500">Neto {fmtMoney(tot.neto, mon)} · IVA {fmtMoney(tot.iva, mon)} · Total {fmtMoney(tot.total, mon)}</span>}
            <button onClick={importar} disabled={importing} className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar como {tipo === 'VENTAS' ? 'facturas emitidas' : 'gastos'}
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-2 font-medium">Tipo</th><th className="px-4 py-2 font-medium">Folio</th><th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">{tipo === 'VENTAS' ? 'Cliente' : 'Proveedor'}</th>
                  <th className="px-4 py-2 text-right font-medium">Neto</th><th className="px-4 py-2 text-right font-medium">IVA</th><th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {parsed.filas.slice(0, 200).map((f, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="px-4 py-1.5 text-xs text-neutral-500">{f.tipoDoc === '61' ? 'NC' : f.tipoDoc === '56' ? 'ND' : f.tipoDoc}</td>
                    <td className="px-4 py-1.5">{f.folio}</td>
                    <td className="px-4 py-1.5 text-xs text-neutral-500">{fmtFecha(f.fecha + 'T12:00:00')}</td>
                    <td className="px-4 py-1.5"><div className="truncate">{f.razonSocial}</div><div className="text-[10px] text-neutral-400">{f.rut}</div></td>
                    <td className="px-4 py-1.5 text-right">{fmtMoney(f.neto + f.exento, mon)}</td>
                    <td className="px-4 py-1.5 text-right text-neutral-500">{fmtMoney(f.iva, mon)}</td>
                    <td className="px-4 py-1.5 text-right font-medium">{fmtMoney(f.total, mon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.filas.length > 200 && <div className="px-4 py-2 text-xs text-neutral-400">… y {parsed.filas.length - 200} más</div>}
          </div>
          <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
            Columnas detectadas: {Object.entries(parsed.columnas).map(([k, v]) => `${k} → "${v}"`).join(' · ')}
          </div>
        </div>
      )}
    </div>
  );
}
