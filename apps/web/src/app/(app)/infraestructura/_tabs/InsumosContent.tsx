'use client';

// ============================================================
// Insumos y consumibles — catálogo por rubro, declaración
// mensual por sector, consolidado de compras y desvíos.
// Stock crítico = consumo/día × plazo proveedor × 1,20.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Package, AlertTriangle, Plus, RefreshCw, Trash2,
  ArrowDownToLine, ArrowUpFromLine, ShoppingCart, Scale,
} from 'lucide-react';

const RUBROS = ['LIMPIEZA', 'LIBRERIA', 'FILM', 'LUBRICANTE', 'EP', 'OTRO'] as const;
const RUBRO_LABEL: Record<string, string> = {
  LIMPIEZA: 'Limpieza', LIBRERIA: 'Librería', FILM: 'Film/stretch', LUBRICANTE: 'Lubricantes', EP: 'Elementos protección', OTRO: 'Otro',
};
const fmtN = (n: number) => Math.round(n).toLocaleString('es-AR');
const fmtD = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

interface Item {
  id: string; code: string; name: string; rubro: string; unit: string;
  currentStock: number; leadTimeDays: number; minStock: number; safetyFactor: number;
  supplier?: string; location?: string; unitCost: number;
  consumoDia: number; stockCritico: number; criticoOrigen: string; bajoStock: boolean; diasAutonomia: number | null;
}
interface Need { id: string; itemId: string; sector: string; monthlyQty: number; responsibleName?: string; notes?: string; item?: { name: string; unit: string; rubro: string } }
interface Fila { itemId: string; code: string; name: string; rubro: string; unit: string; sectores: { sector: string; monthlyQty: number }[]; needTotal: number; currentStock: number; stockCritico: number; sugerido: number; unitCost: number; costoEstimado: number; proveedor?: string }
interface Desvio { itemId: string; item: string; unit: string; sector: string; responsible?: string; declarado: number; consumido: number; desvio: number; desvioPct: number }

type Vista = 'catalogo' | 'necesidades' | 'compras' | 'desvios';

export default function InsumosContent() {
  const [vista, setVista] = useState<Vista>('catalogo');
  const [items, setItems] = useState<Item[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [desvios, setDesvios] = useState<Desvio[]>([]);
  const [totalEst, setTotalEst] = useState(0);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [movForm, setMovForm] = useState<Item | null>(null);
  const [needForm, setNeedForm] = useState(false);
  const [f, setF] = useState<any>({});
  const [mv, setMv] = useState<any>({ delta: '', motivo: '', sector: '' });
  const [nd, setNd] = useState<any>({ itemId: '', sector: '', monthlyQty: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch<any>('/supplies/items');
      setItems(r.items || []);
      const n = await apiFetch<any>(`/supplies/needs?period=${period}`);
      setNeeds(n.needs || []);
      const c = await apiFetch<any>(`/supplies/consolidado?period=${period}`);
      setFilas(c.filas || []);
      setTotalEst(c.totalEstimado || 0);
      const d = await apiFetch<any>(`/supplies/desvios?period=${period}`);
      setDesvios(d.rows || []);
    } catch {
      setErr('No se pudieron cargar los insumos (¿la migración está aplicada?).');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const bajos = useMemo(() => items.filter((i) => i.bajoStock), [items]);

  const saveItem = async () => {
    setSaving(true);
    try {
      await apiFetch('/supplies/items', {
        method: 'POST',
        json: {
          code: f.code, name: f.name, rubro: f.rubro || 'OTRO', unit: f.unit || 'unidad',
          leadTimeDays: parseInt(f.leadTimeDays || '3'), minStock: parseFloat(f.minStock || '0'),
          safetyFactor: parseFloat(f.safetyFactor || '1.2'), supplier: f.supplier || null,
          location: f.location || null, unitCost: parseFloat(f.unitCost || '0'),
          currentStock: parseFloat(f.currentStock || '0'), description: f.description || null,
        },
      });
      setForm(false); setF({});
      await load();
    } catch (e: any) { setErr(e?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const saveMov = async () => {
    if (!movForm) return;
    setSaving(true);
    try {
      await apiFetch(`/supplies/items/${movForm.id}/movimientos`, {
        method: 'POST',
        json: { delta: parseFloat(mv.delta), motivo: mv.motivo, sector: mv.sector || null },
      });
      setMovForm(null); setMv({ delta: '', motivo: '', sector: '' });
      await load();
    } catch (e: any) { setErr(e?.error || 'Error al registrar'); }
    finally { setSaving(false); }
  };

  const saveNeed = async () => {
    setSaving(true);
    try {
      await apiFetch('/supplies/needs', {
        method: 'POST',
        json: { itemId: nd.itemId, sector: nd.sector, period, monthlyQty: parseFloat(nd.monthlyQty), notes: nd.notes || null },
      });
      setNeedForm(false); setNd({ itemId: '', sector: '', monthlyQty: '' });
      await load();
    } catch (e: any) { setErr(e?.error || 'Error al declarar'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[13px] outline-none focus:border-sky-400';
  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500';
  const td = 'px-3 py-2 text-[13px] text-neutral-800';

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-3.5"><p className="text-[11px] font-semibold uppercase text-neutral-400">Ítems en catálogo</p><p className="mt-1 text-2xl font-bold text-neutral-900">{items.length}</p></div>
        <div className={`rounded-xl border p-3.5 ${bajos.length ? 'border-red-200 bg-red-50' : 'bg-white'}`}>
          <p className="text-[11px] font-semibold uppercase text-neutral-400">Bajo stock crítico</p>
          <p className={`mt-1 text-2xl font-bold ${bajos.length ? 'text-red-600' : 'text-neutral-900'}`}>{bajos.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-3.5"><p className="text-[11px] font-semibold uppercase text-neutral-400">Sectores declarando</p><p className="mt-1 text-2xl font-bold text-neutral-900">{new Set(needs.map((n) => n.sector)).size}</p></div>
        <div className="rounded-xl border bg-white p-3.5"><p className="text-[11px] font-semibold uppercase text-neutral-400">Compra sugerida {period}</p><p className="mt-1 text-2xl font-bold text-sky-700">${fmtN(totalEst)}</p></div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {([['catalogo', Package, 'Catálogo'], ['necesidades', ShoppingCart, 'Necesidades'], ['compras', Scale, 'Compras consolidadas'], ['desvios', AlertTriangle, 'Desvíos']] as const).map(([k, Icon, lbl]) => (
          <button key={k} onClick={() => setVista(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${vista === k ? 'bg-sky-600 text-white' : 'bg-white border text-neutral-600 hover:border-sky-300'}`}>
            <Icon size={14} /> {lbl}
          </button>
        ))}
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={`ml-auto ${inp} !w-auto`} />
        <button onClick={load} className="rounded-lg border p-2 text-neutral-500 hover:bg-neutral-50" aria-label="Recargar"><RefreshCw size={15} /></button>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}
      {loading && <p className="text-[13px] text-neutral-400">Cargando…</p>}

      {/* ── CATÁLOGO ── */}
      {vista === 'catalogo' && !loading && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-[13px] font-semibold">Catálogo de insumos</p>
            <button onClick={() => setForm(true)} className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-sky-700"><Plus size={13} /> Nuevo insumo</button>
          </div>
          <table className="w-full">
            <thead className="border-b bg-neutral-50"><tr><th className={th}>Insumo</th><th className={th}>Rubro</th><th className={th}>Stock</th><th className={th}>Crítico</th><th className={th}>Consumo/día</th><th className={th}>Autonomía</th><th className={th}>Proveedor · plazo</th><th className={th}></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`border-b last:border-0 ${i.bajoStock ? 'bg-red-50/60' : ''}`}>
                  <td className={td}><p className="font-semibold">{i.name}</p><p className="text-[11px] text-neutral-400">{i.code} · {i.unit}</p></td>
                  <td className={td}>{RUBRO_LABEL[i.rubro] || i.rubro}</td>
                  <td className={td}><span className={`font-semibold ${i.bajoStock ? 'text-red-600' : ''}`}>{fmtD(i.currentStock)}</span></td>
                  <td className={td}>{fmtD(i.stockCritico)} <span className="text-[10px] text-neutral-400">({i.criticoOrigen})</span></td>
                  <td className={td}>{fmtD(i.consumoDia)}</td>
                  <td className={td}>{i.diasAutonomia != null ? `${i.diasAutonomia} días` : '—'}</td>
                  <td className={td}><p className="text-[12px]">{i.supplier || '—'}</p><p className="text-[10px] text-neutral-400">{i.leadTimeDays}d</p></td>
                  <td className={td}><button onClick={() => setMovForm(i)} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50">Movimiento</button></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-neutral-400">Sin insumos. Cargá el primero para empezar.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NECESIDADES ── */}
      {vista === 'necesidades' && !loading && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-[13px] font-semibold">Necesidades mensuales por sector — {period}</p>
            <button onClick={() => setNeedForm(true)} className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-sky-700"><Plus size={13} /> Declarar necesidad</button>
          </div>
          <table className="w-full">
            <thead className="border-b bg-neutral-50"><tr><th className={th}>Sector</th><th className={th}>Insumo</th><th className={th}>Rubro</th><th className={th}>Cantidad/mes</th><th className={th}>Responsable</th><th className={th}></th></tr></thead>
            <tbody>
              {needs.map((n) => (
                <tr key={n.id} className="border-b last:border-0">
                  <td className={td}><span className="rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">{n.sector}</span></td>
                  <td className={td}>{n.item?.name}</td>
                  <td className={td}>{RUBRO_LABEL[n.item?.rubro || ''] || n.item?.rubro}</td>
                  <td className={td}><b>{fmtD(n.monthlyQty)}</b> {n.item?.unit}</td>
                  <td className={td}><p className="text-[12px]">{n.responsibleName || '—'}</p></td>
                  <td className={td}><button onClick={async () => { await apiFetch(`/supplies/needs/${n.id}`, { method: 'DELETE' }); load(); }} className="text-neutral-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {!needs.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-400">Ningún sector declaró necesidades para {period}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── COMPRAS CONSOLIDADAS ── */}
      {vista === 'compras' && !loading && (
        <div className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-[13px] font-semibold">Consolidado de compras — {period} · sugerido = necesidad + stock crítico − stock</p>
            <p className="text-[13px] font-bold text-sky-700">Total estimado: ${fmtN(totalEst)}</p>
          </div>
          <table className="w-full">
            <thead className="border-b bg-neutral-50"><tr><th className={th}>Insumo</th><th className={th}>Sectores</th><th className={th}>Necesidad</th><th className={th}>Stock actual</th><th className={th}>A comprar</th><th className={th}>Costo est.</th><th className={th}>Proveedor</th></tr></thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.itemId} className="border-b last:border-0">
                  <td className={td}><p className="font-semibold">{r.name}</p><p className="text-[11px] text-neutral-400">{RUBRO_LABEL[r.rubro] || r.rubro} · {r.unit}</p></td>
                  <td className={td}><p className="text-[11.5px] text-neutral-600">{r.sectores.map((s) => `${s.sector} (${fmtD(s.monthlyQty)})`).join(', ')}</p></td>
                  <td className={td}>{fmtD(r.needTotal)}</td>
                  <td className={td}>{fmtD(r.currentStock)}</td>
                  <td className={td}><span className={`rounded-md px-2 py-0.5 font-bold ${r.sugerido > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{fmtD(r.sugerido)}</span></td>
                  <td className={td}>${fmtN(r.costoEstimado)}</td>
                  <td className={td}><p className="text-[12px]">{r.proveedor || '—'}</p></td>
                </tr>
              ))}
              {!filas.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-neutral-400">Sin necesidades declaradas para consolidar.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DESVÍOS ── */}
      {vista === 'desvios' && !loading && (
        <div className="rounded-xl border bg-white">
          <div className="border-b px-4 py-2.5"><p className="text-[13px] font-semibold">Desvíos declarado vs consumo real — {period}</p></div>
          <table className="w-full">
            <thead className="border-b bg-neutral-50"><tr><th className={th}>Sector</th><th className={th}>Insumo</th><th className={th}>Declarado</th><th className={th}>Consumido</th><th className={th}>Desvío</th><th className={th}>Responsable</th></tr></thead>
            <tbody>
              {desvios.map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className={td}><span className="rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">{d.sector}</span></td>
                  <td className={td}>{d.item} <span className="text-[11px] text-neutral-400">({d.unit})</span></td>
                  <td className={td}>{fmtD(d.declarado)}</td>
                  <td className={td}>{fmtD(d.consumido)}</td>
                  <td className={td}>
                    <span className={`rounded-md px-2 py-0.5 font-bold ${d.desvio > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {d.desvio > 0 ? '+' : ''}{fmtD(d.desvio)} ({d.desvioPct > 0 ? '+' : ''}{d.desvioPct}%)
                    </span>
                  </td>
                  <td className={td}><p className="text-[12px]">{d.responsible || '—'}</p></td>
                </tr>
              ))}
              {!desvios.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-neutral-400">Sin datos para comparar en {period}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* modal nuevo insumo */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <p className="mb-3 font-bold">Nuevo insumo</p>
            <div className="grid grid-cols-2 gap-2.5">
              <input placeholder="Código *" className={inp} value={f.code || ''} onChange={(e) => setF({ ...f, code: e.target.value })} />
              <input placeholder="Nombre *" className={inp} value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <select className={inp} value={f.rubro || 'OTRO'} onChange={(e) => setF({ ...f, rubro: e.target.value })}>{RUBROS.map((r) => <option key={r} value={r}>{RUBRO_LABEL[r]}</option>)}</select>
              <input placeholder="Unidad (unidad, litro, caja…)" className={inp} value={f.unit || ''} onChange={(e) => setF({ ...f, unit: e.target.value })} />
              <input placeholder="Proveedor" className={inp} value={f.supplier || ''} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
              <input placeholder="Plazo entrega (días)" type="number" className={inp} value={f.leadTimeDays || ''} onChange={(e) => setF({ ...f, leadTimeDays: e.target.value })} />
              <input placeholder="Stock inicial" type="number" className={inp} value={f.currentStock || ''} onChange={(e) => setF({ ...f, currentStock: e.target.value })} />
              <input placeholder="Stock mín. manual (0=auto)" type="number" className={inp} value={f.minStock || ''} onChange={(e) => setF({ ...f, minStock: e.target.value })} />
              <input placeholder="Costo unitario $" type="number" className={inp} value={f.unitCost || ''} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
              <input placeholder="Ubicación" className={inp} value={f.location || ''} onChange={(e) => setF({ ...f, location: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setForm(false)} className="rounded-lg border px-3.5 py-1.5 text-[13px] text-neutral-600">Cancelar</button>
              <button onClick={saveItem} disabled={saving || !f.code || !f.name} className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* modal movimiento */}
      {movForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="font-bold">Movimiento — {movForm.name}</p>
            <p className="mb-3 text-[12px] text-neutral-500">Stock actual: {fmtD(movForm.currentStock)} {movForm.unit} · negativo = egreso, positivo = ingreso</p>
            <div className="space-y-2.5">
              <input placeholder="Cantidad (ej. -5 o 20) *" type="number" className={inp} value={mv.delta} onChange={(e) => setMv({ ...mv, delta: e.target.value })} />
              <input placeholder="Motivo * (ej. consumo taller, compra mensual)" className={inp} value={mv.motivo} onChange={(e) => setMv({ ...mv, motivo: e.target.value })} />
              <input placeholder="Sector consumidor (para desvíos)" className={inp} value={mv.sector} onChange={(e) => setMv({ ...mv, sector: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setMovForm(null)} className="rounded-lg border px-3.5 py-1.5 text-[13px] text-neutral-600">Cancelar</button>
              <button onClick={saveMov} disabled={saving || !mv.delta || mv.motivo.length < 2} className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">
                {parseFloat(mv.delta) < 0 ? <ArrowUpFromLine size={13} /> : <ArrowDownToLine size={13} />} Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal declarar necesidad */}
      {needForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="mb-1 font-bold">Declarar necesidad — {period}</p>
            <p className="mb-3 text-[12px] text-neutral-500">Consumo mensual promedio del sector</p>
            <div className="space-y-2.5">
              <input placeholder="Sector * (ej. Depósito, Administración)" className={inp} value={nd.sector} onChange={(e) => setNd({ ...nd, sector: e.target.value })} />
              <select className={inp} value={nd.itemId} onChange={(e) => setNd({ ...nd, itemId: e.target.value })}>
                <option value="">Insumo *</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({RUBRO_LABEL[i.rubro] || i.rubro})</option>)}
              </select>
              <input placeholder="Cantidad mensual *" type="number" className={inp} value={nd.monthlyQty} onChange={(e) => setNd({ ...nd, monthlyQty: e.target.value })} />
              <input placeholder="Notas (opcional)" className={inp} value={nd.notes || ''} onChange={(e) => setNd({ ...nd, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNeedForm(false)} className="rounded-lg border px-3.5 py-1.5 text-[13px] text-neutral-600">Cancelar</button>
              <button onClick={saveNeed} disabled={saving || !nd.sector || !nd.itemId || !nd.monthlyQty} className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40">Declarar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
