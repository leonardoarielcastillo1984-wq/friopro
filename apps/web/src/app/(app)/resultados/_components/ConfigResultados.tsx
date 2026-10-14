'use client';

// CONFIGURACIÓN DE RESULTADOS — modal con los ajustes gerenciales:
// metas mensuales/anuales, tipos de cambio para consolidado, cierre de
// períodos (bloqueo de carga) e informe ejecutivo automático por email.
// Todo se persiste en Tenant.resultadosConfig vía PUT /finanzas/config.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Loader2, Plus, Trash2, Check, Target, ArrowLeftRight, Lock, Mail, Info } from 'lucide-react';
import { MESES } from './fmt';
import { useAsistente } from './useAsistente';

type Config = {
  monedaLocal: string | null; monedaDefault: string | null; country: string | null;
  metas: { ventasMensual?: number; resultadoMensual?: number; ventasAnual?: number; resultadoAnual?: number };
  tiposCambio: Record<string, Record<string, number>>;
  periodosCerrados: string[];
  informeEmail: { activo?: boolean; emails?: string[]; ultimoEnvio?: string } | null;
  presupuesto: Record<string, number>;
  alertas: { atencion?: number; critica?: number };
};

export default function ConfigResultados({ monedas, canEdit, onClose }: { monedas: string[]; canEdit: boolean; onClose: () => void }) {
  const A = useAsistente({});
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const hoy = new Date();

  useEffect(() => {
    apiFetch<Config>('/finanzas/config').then(setCfg).catch(() => setCfg(null)).finally(() => setLoading(false));
  }, []);

  const put = async (json: any, tag: string) => {
    setSaving(tag); setOk(null);
    try {
      const r = await apiFetch<Config>('/finanzas/config', { method: 'PUT', json });
      setCfg(prev => prev ? { ...prev, ...r } : r);
      setOk(tag);
    } catch { /* silencio: el usuario ve que no se aplicó */ }
    finally { setSaving(null); }
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-neutral-400 focus:outline-none';
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() === '' ? null : (Number.isFinite(n) ? n : null); };

  // ── Metas ──
  const [metas, setMetas] = useState({ ventasMensual: '', resultadoMensual: '', ventasAnual: '', resultadoAnual: '' });
  useEffect(() => {
    if (cfg) setMetas({
      ventasMensual: cfg.metas?.ventasMensual != null ? String(cfg.metas.ventasMensual) : '',
      resultadoMensual: cfg.metas?.resultadoMensual != null ? String(cfg.metas.resultadoMensual) : '',
      ventasAnual: cfg.metas?.ventasAnual != null ? String(cfg.metas.ventasAnual) : '',
      resultadoAnual: cfg.metas?.resultadoAnual != null ? String(cfg.metas.resultadoAnual) : '',
    });
  }, [cfg?.metas]);

  // ── Tipos de cambio: filas { moneda, periodo('*'|YYYY-MM), tasa } ──
  const [tc, setTc] = useState<{ moneda: string; periodo: string; tasa: string }[]>([]);
  useEffect(() => {
    if (!cfg) return;
    const filas: { moneda: string; periodo: string; tasa: string }[] = [];
    for (const [mon, tasas] of Object.entries(cfg.tiposCambio || {}))
      for (const [per, tasa] of Object.entries(tasas || {})) filas.push({ moneda: mon, periodo: per, tasa: String(tasa) });
    setTc(filas);
  }, [cfg?.tiposCambio]);

  const guardarTc = () => {
    const out: Record<string, Record<string, number | null>> = {};
    // Borra todo lo que ya estaba y regraba lo de la tabla (null = borrar)
    for (const [mon, tasas] of Object.entries(cfg?.tiposCambio || {}))
      for (const per of Object.keys(tasas || {})) { out[mon] = out[mon] || {}; out[mon][per] = null; }
    for (const f of tc) {
      const mon = f.moneda.toUpperCase();
      const tasa = Number(f.tasa);
      if (!/^[A-Z]{3}$/.test(mon) || !Number.isFinite(tasa) || tasa <= 0) continue;
      out[mon] = out[mon] || {};
      out[mon][f.periodo || '*'] = tasa;
    }
    put({ tiposCambio: out }, 'tc');
  };

  // ── Períodos cerrados ──
  const [nuevoPeriodo, setNuevoPeriodo] = useState(`${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth()).padStart(2, '0')}`); // mes ANTERIOR por defecto
  const togglePeriodo = (key: string) => {
    const act = cfg?.periodosCerrados || [];
    put({ periodosCerrados: act.includes(key) ? act.filter(k => k !== key) : [...act, key].sort() }, `pc-${key}`);
  };

  // ── Informe email ──
  const [infActivo, setInfActivo] = useState(false);
  const [infEmails, setInfEmails] = useState('');
  useEffect(() => {
    if (cfg) { setInfActivo(!!cfg.informeEmail?.activo); setInfEmails((cfg.informeEmail?.emails || []).join(', ')); }
  }, [cfg?.informeEmail]);

  const monedasExtra = monedas.filter(m => m !== (cfg?.monedaDefault || cfg?.monedaLocal || ''));
  const selCls = 'rounded-lg border border-neutral-200 px-2 py-1 text-xs';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ${A.wrap.className}`} onClickCapture={A.onAsistenteClick} onClick={e => e.stopPropagation()}>
        {A.Estilos}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-neutral-900">Configuración de Resultados</h2>
          <div className="flex items-center gap-2">
            <A.Boton />
            <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
          </div>
        </div>
        {A.Panel}
        {!canEdit && <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">Modo consulta — no podés guardar cambios.</p>}
        {loading ? <div className="py-10 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={18} /></div> : !cfg ? (
          <p className="py-10 text-center text-sm text-neutral-400">No se pudo cargar la configuración.</p>
        ) : (
          <div className="space-y-5">
            {/* ═══ Metas ═══ */}
            <section className="rounded-xl border border-neutral-200 p-4" data-explica="meta-ventas" data-explica-titulo="Metas">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Target size={14} className="text-emerald-600" />Metas {ok === 'metas' && <Check size={13} className="text-green-600" />}</h3>
              <p className="mb-3 text-[11px] text-neutral-400">Objetivos de ventas y resultado. El Dashboard muestra el avance contra estas metas. Dejá en blanco lo que no uses.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['ventasMensual', 'Ventas / mes'], ['resultadoMensual', 'Resultado / mes'],
                  ['ventasAnual', 'Ventas / año'], ['resultadoAnual', 'Resultado / año'],
                ].map(([k, lbl]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">{lbl} ({cfg.monedaDefault || cfg.monedaLocal || 'moneda base'})</span>
                    <input type="number" value={(metas as any)[k]} onChange={e => setMetas(m => ({ ...m, [k]: e.target.value }))} className={inputCls} disabled={!canEdit} placeholder="—" />
                  </label>
                ))}
              </div>
              <button onClick={() => put({ metas: { ventasMensual: numOrNull(metas.ventasMensual), resultadoMensual: numOrNull(metas.resultadoMensual), ventasAnual: numOrNull(metas.ventasAnual), resultadoAnual: numOrNull(metas.resultadoAnual) } }, 'metas')}
                disabled={!canEdit || saving === 'metas'}
                className="mt-3 flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                {saving === 'metas' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Guardar metas
              </button>
            </section>

            {/* ═══ Tipos de cambio ═══ */}
            <section className="rounded-xl border border-neutral-200 p-4" data-explica="tipos-cambio" data-explica-titulo="Tipos de cambio para consolidado">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><ArrowLeftRight size={14} className="text-violet-600" />Tipos de cambio {ok === 'tc' && <Check size={13} className="text-green-600" />}</h3>
              <p className="mb-3 text-[11px] text-neutral-400">
                Se usan al elegir <b>Todas (consolidado)</b>: cuántas unidades de <b>{cfg.monedaDefault || cfg.monedaLocal || 'la moneda base'}</b> vale 1 unidad de la moneda origen. Período <b>*</b> = tasa por defecto; un mes específico (ej. {hoy.getUTCFullYear()}-{String(hoy.getUTCMonth() + 1).padStart(2, '0')}) la pisa.
              </p>
              <div className="space-y-1.5">
                {tc.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={f.moneda} onChange={e => setTc(v => v.map((x, j) => j === i ? { ...x, moneda: e.target.value } : x))} className={selCls} disabled={!canEdit}>
                      {[...new Set([f.moneda, ...monedasExtra])].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="month" value={f.periodo === '*' ? '' : f.periodo} onChange={e => setTc(v => v.map((x, j) => j === i ? { ...x, periodo: e.target.value || '*' } : x))} className={`${selCls} w-36`} disabled={!canEdit} title="Vacío = tasa por defecto (*)" />
                    <span className="text-[10px] text-neutral-400">{f.periodo === '*' ? 'default' : ''}</span>
                    <input type="number" value={f.tasa} onChange={e => setTc(v => v.map((x, j) => j === i ? { ...x, tasa: e.target.value } : x))} className={`${inputCls} w-28`} disabled={!canEdit} placeholder="950" step="0.0001" />
                    <button onClick={() => setTc(v => v.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-500" disabled={!canEdit}><Trash2 size={13} /></button>
                  </div>
                ))}
                {tc.length === 0 && <p className="text-xs text-neutral-400">Sin tipos de cambio configurados.</p>}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={() => setTc(v => [...v, { moneda: monedasExtra[0] || 'USD', periodo: '*', tasa: '' }])} disabled={!canEdit}
                  className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
                  <Plus size={12} />Agregar tasa
                </button>
                <button onClick={guardarTc} disabled={!canEdit || saving === 'tc'}
                  className="flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                  {saving === 'tc' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Guardar tipos
                </button>
              </div>
            </section>

            {/* ═══ Períodos cerrados ═══ */}
            <section className="rounded-xl border border-neutral-200 p-4" data-explica="cierre-periodo" data-explica-titulo="Cierre de período">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Lock size={14} className="text-amber-600" />Cierre de períodos</h3>
              <p className="mb-3 text-[11px] text-neutral-400">Meses congelados: no se pueden crear, editar ni borrar documentos con fecha de ese mes (devuelve 423). Útil cuando ya reportaste el período al contador o al directorio.</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(cfg.periodosCerrados || []).map(p => (
                  <button key={p} onClick={() => togglePeriodo(p)} disabled={!canEdit}
                    className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    title="Click para reabrir el período">
                    <Lock size={10} />{MESES[Number(p.slice(5)) - 1]} {p.slice(0, 4)}
                  </button>
                ))}
                {!(cfg.periodosCerrados || []).length && <span className="text-xs text-neutral-400">Ningún período cerrado.</span>}
              </div>
              <div className="flex items-center gap-2">
                <input type="month" value={nuevoPeriodo} onChange={e => setNuevoPeriodo(e.target.value)} className={selCls} />
                <button onClick={() => togglePeriodo(nuevoPeriodo)} disabled={!canEdit || !nuevoPeriodo || (cfg.periodosCerrados || []).includes(nuevoPeriodo)}
                  className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                  {saving?.startsWith('pc-') ? <Loader2 size={12} className="animate-spin" /> : <Lock size={11} />}Cerrar período
                </button>
              </div>
            </section>

            {/* ═══ Informe por email ═══ */}
            <section className="rounded-xl border border-neutral-200 p-4" data-explica="informe-email" data-explica-titulo="Informe ejecutivo por email">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Mail size={14} className="text-blue-600" />Informe ejecutivo automático {ok === 'inf' && <Check size={13} className="text-green-600" />}</h3>
              <p className="mb-3 text-[11px] text-neutral-400">El día 1 de cada mes se envía por email el resumen del mes anterior: ventas, costos, resultado, caja, principales costos y alertas.</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={infActivo} onChange={e => setInfActivo(e.target.checked)} disabled={!canEdit} className="h-4 w-4 rounded border-neutral-300" />
                Enviar informe mensual automáticamente
              </label>
              <input value={infEmails} onChange={e => setInfEmails(e.target.value)} disabled={!canEdit}
                className={inputCls} placeholder="gerente@empresa.com, directorio@empresa.com (separados por coma)" />
              {cfg.informeEmail?.ultimoEnvio && <p className="mt-1 text-[10px] text-neutral-400">Último envío: período {cfg.informeEmail.ultimoEnvio}.</p>}
              <button onClick={() => put({ informeEmail: { activo: infActivo, emails: infEmails.split(/[,\s]+/).filter(e => e.includes('@')).slice(0, 10) } }, 'inf')}
                disabled={!canEdit || saving === 'inf'}
                className="mt-2.5 flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                {saving === 'inf' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Guardar informe
              </button>
            </section>

            <p className="flex items-start gap-1.5 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
              <Info size={12} className="mt-0.5 shrink-0" />
              El umbral de alertas (atención/crítica) y la tasa de IVA por moneda también se guardan acá, pero se editan en su propia sección del Dashboard y del panel IVA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
