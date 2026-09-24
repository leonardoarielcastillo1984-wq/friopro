'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Info, Gauge,
  Wrench, Disc, FileText, Clock, DollarSign, Settings2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Proyección — ¿qué pasa si recorro…?
// Tres métricas diferenciadas, nunca "salud%" = odómetro÷constante:
//  A) intervalo consumido (puede >100% = vencido)
//  B) recorrido respecto de referencia de vida en servicio (banda)
//  C) condición medida (medición real con fecha y unidad)
// ═══════════════════════════════════════════════════════════════

const METRICA_LABEL: Record<string, string> = {
  INTERVALO_MANTENIMIENTO: 'Intervalo de mantenimiento',
  VIDA_SERVICIO_REF: 'Referencia de vida en servicio',
  CONDICION_MEDIDA: 'Condición medida',
};
const SITUACION: Record<string, { label: string; cls: string }> = {
  AL_DIA: { label: 'Al día', cls: 'bg-green-100 text-green-700' },
  PROXIMO: { label: 'Próximo', cls: 'bg-amber-100 text-amber-700' },
  VENCIDO: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
  EVALUAR: { label: 'En rango de evaluación', cls: 'bg-amber-100 text-amber-700' },
  SUPERADO: { label: 'Supera rango orientativo', cls: 'bg-red-100 text-red-700' },
  MEDIDA: { label: 'Con medición', cls: 'bg-blue-100 text-blue-700' },
  SIN_MEDICION: { label: 'Sin medición', cls: 'bg-neutral-100 text-neutral-500' },
  SIN_HISTORIAL: { label: 'Sin historial', cls: 'bg-neutral-100 text-neutral-500' },
  SIN_REFERENCIA: { label: 'Sin referencia', cls: 'bg-neutral-100 text-neutral-500' },
};
const EVIDENCIA: Record<string, { label: string; cls: string }> = {
  VERIFICADA: { label: 'Referencia verificada', cls: 'bg-green-100 text-green-700' },
  INTERNA_APROBADA: { label: 'Interna aprobada', cls: 'bg-blue-100 text-blue-700' },
  PROVISIONAL: { label: 'Hipótesis configurable', cls: 'bg-amber-100 text-amber-700' },
  FALTANTE: { label: 'Sin referencia validada', cls: 'bg-neutral-100 text-neutral-500' },
  MEDIDA: { label: 'Condición medida', cls: 'bg-blue-100 text-blue-700' },
};
const SISTEMAS_ORDER = ['MOTOR', 'TRANSMISION', 'FRENOS', 'REFRIGERACION', 'ELECTRICO', 'NEUMATICOS', 'DIRECCION_SUSPENSION', 'CHASIS', 'GENERAL'];
const SISTEMA_LABEL: Record<string, string> = {
  MOTOR: 'Motor', TRANSMISION: 'Transmisión', FRENOS: 'Frenos', REFRIGERACION: 'Refrigeración',
  ELECTRICO: 'Arranque y carga', NEUMATICOS: 'Neumáticos', DIRECCION_SUSPENSION: 'Dirección y suspensión', CHASIS: 'Chasis', GENERAL: 'General',
};

function fmtKm(n: number | null | undefined) { return n != null ? `${Math.round(n).toLocaleString('es-AR')} km` : '—'; }
function fmtFecha(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function fmtMoney(n: number | null | undefined) { return n != null ? `$ ${Math.round(n).toLocaleString('es-AR')}` : '—'; }

export default function ProyeccionPanel({ vehiculoId }: { vehiculoId: string }) {
  const [proy, setProy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [proyKm, setProyKm] = useState<number | null>(null);
  const [escenario, setEscenario] = useState<'con' | 'sin'>('con');
  const [kmMesHip, setKmMesHip] = useState('');
  const [meses, setMeses] = useState('');
  const [perfil, setPerfil] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [porQueAbierto, setPorQueAbierto] = useState<Record<string, boolean>>({});

  const cargar = async (km: number) => {
    setProyKm(km); setLoading(true);
    try {
      const params = new URLSearchParams({ km: String(km), escenario });
      if (kmMesHip) params.set('kmMes', kmMesHip);
      if (meses) params.set('meses', meses);
      if (perfil) params.set('perfil', perfil);
      const r = await apiFetch<any>(`/flota/vehiculos/${vehiculoId}/proyeccion?${params}`);
      setProy(r.proyeccion || null);
    } catch { setProy(null); }
    finally { setLoading(false); }
  };

  // Agrupar componentes por sistema
  const porSistema: Record<string, any[]> = {};
  for (const c of proy?.componentes || []) {
    (porSistema[c.sistema] = porSistema[c.sistema] || []).push(c);
  }
  const sistemas = SISTEMAS_ORDER.filter(s => porSistema[s]?.length);

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-neutral-800">Proyección — ¿qué pasa si recorro…?</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[10000, 50000, 100000, 200000].map((k) => (
            <button key={k} onClick={() => cargar(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${proyKm === k && proy ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
              +{(k / 1000).toLocaleString('es-AR')}k
            </button>
          ))}
          <input type="number" min={1000} step={5000} placeholder="km" className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (v >= 1000 && v <= 500000) cargar(v); } }} />
          <button onClick={() => setShowConfig(s => !s)} className="rounded-md border border-neutral-300 p-1 text-neutral-500 hover:bg-neutral-50" title="Escenario y ritmo de uso"><Settings2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Configuración del escenario */}
      {showConfig && (
        <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Escenario:</span>
            <select value={escenario} onChange={e => setEscenario(e.target.value as any)} className="rounded border border-neutral-300 px-1.5 py-1">
              <option value="con">Con mantenimiento programado</option>
              <option value="sin">Sin ejecutar mantenimiento</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Meses:</span>
            <input type="number" min={0} max={120} placeholder="—" value={meses} onChange={e => setMeses(e.target.value)} className="w-16 rounded border border-neutral-300 px-1.5 py-1" />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Hipótesis km/mes:</span>
            <input type="number" min={0} max={50000} placeholder="—" value={kmMesHip} onChange={e => setKmMesHip(e.target.value)} className="w-20 rounded border border-neutral-300 px-1.5 py-1" />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Perfil:</span>
            <select value={perfil} onChange={e => setPerfil(e.target.value)} className="rounded border border-neutral-300 px-1.5 py-1">
              <option value="">—</option><option value="RUTA">Ruta</option><option value="URBANO">Urbano</option><option value="OBRA">Obra</option><option value="MIXTO">Mixto</option>
            </select>
          </label>
          <span className="text-[10px] text-neutral-400">El perfil y la hipótesis km/mes se muestran en cada proyección; no se deducen silenciosamente.</span>
        </div>
      )}

      {!proy && !loading && <p className="text-xs text-neutral-400">Elegí un kilometraje para proyectar servicios, condición y costos estimados.</p>}
      {loading && <p className="text-xs text-neutral-400">Proyectando…</p>}

      {proy && !loading && (
        <div className="space-y-4">
          {/* Resumen del horizonte */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
            <span>De <b>{fmtKm(proy.kmActual)}</b> a <b>{fmtKm(proy.kmFinal)}</b></span>
            {proy.fechaEstimada
              ? <span>≈ {proy.diasEstimados} días (hasta ~{fmtFecha(proy.fechaEstimada)}){proy.ritmoUso?.kmMes ? ` · ${proy.ritmoUso.kmMes.toLocaleString('es-AR')} km/mes` : ''}{proy.ritmoUso?.fuente === 'HIPOTESIS_USUARIO' ? ' (hipótesis declarada)' : proy.ritmoUso?.fuente === 'HISTORIAL_ODOMETRO' ? ' (historial de odómetro)' : ''}</span>
              : <span className="text-neutral-400">Sin ritmo de uso: escenario solo por distancia, sin fechas inventadas</span>}
            <span className="text-neutral-400">Escenario: {proy.escenario === 'SIN_MANTENIMIENTO' ? 'sin mantenimiento' : 'con mantenimiento programado'}{proy.perfil ? ` · perfil ${proy.perfil.toLowerCase()}` : ''}</span>
          </div>

          {proy.advertencias?.length > 0 && (
            <div className="space-y-1">
              {proy.advertencias.map((a: string, i: number) => (
                <p key={i} className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{a}</p>
              ))}
            </div>
          )}

          {/* Costos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500 uppercase">Operativo</p>
              <p className="text-sm font-bold text-neutral-800">{proy.costos.operativo != null ? fmtMoney(proy.costos.operativo) : 'Sin datos'}</p>
              {proy.costos.costoPorKmUsado != null && <p className="text-[10px] text-neutral-400">${proy.costos.costoPorKmUsado}/km</p>}
            </div>
            <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500 uppercase">Servicios</p>
              <p className="text-sm font-bold text-neutral-800">{fmtMoney(proy.costos.serviciosConocido)}</p>
              <p className="text-[10px] text-neutral-400">{proy.componentes.reduce((a: number, c: any) => a + (c.serviciosEnRango || 0), 0)} previstos</p>
            </div>
            <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
              <p className="text-[10px] font-medium text-neutral-500 uppercase">Neumáticos</p>
              <p className="text-sm font-bold text-neutral-800">{fmtMoney(proy.costos.neumaticosConocido)}</p>
              <p className="text-[10px] text-neutral-400">{proy.neumaticos.filter((x: any) => x.reemplazoEnRango).length} reemplazos previstos</p>
            </div>
            <div className={`rounded-md border p-2.5 ${proy.costos.estimacionCompleta ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-[10px] font-medium uppercase ${proy.costos.estimacionCompleta ? 'text-violet-600' : 'text-amber-700'}`}>Subtotal conocido</p>
              <p className={`text-sm font-bold ${proy.costos.estimacionCompleta ? 'text-violet-700' : 'text-amber-800'}`}>{fmtMoney(proy.costos.subtotalConocido)}</p>
              {!proy.costos.estimacionCompleta && <p className="text-[10px] text-amber-700">Estimación incompleta · {proy.costos.conceptosSinPrecio} sin precio</p>}
            </div>
          </div>

          {/* Componentes por sistema */}
          {sistemas.map(sis => (
            <div key={sis}>
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">{SISTEMA_LABEL[sis] || sis}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {porSistema[sis].map((c: any) => (
                  <div key={c.key} className="rounded-md border border-neutral-100 bg-neutral-50 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-neutral-700">{c.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${SITUACION[c.situacion]?.cls || 'bg-neutral-100 text-neutral-500'}`}>{SITUACION[c.situacion]?.label || c.situacion}</span>
                    </div>

                    {/* Métrica según tipo */}
                    {c.tipoMetrica === 'INTERVALO_MANTENIMIENTO' && c.consumoPct != null && (
                      <div>
                        <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                          <span>Intervalo consumido</span>
                          <span className={c.consumoProyectadoPct >= 100 ? 'text-red-600 font-semibold' : ''}>{c.consumoPct}% → {c.consumoProyectadoPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                          <div className={`h-full rounded-full ${c.consumoProyectadoPct >= 100 ? 'bg-red-500' : c.consumoProyectadoPct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, c.consumoProyectadoPct)}%` }} />
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {c.intervalo?.km ? `cada ${c.intervalo.km.toLocaleString('es-AR')} km` : ''}{c.intervalo?.km && c.intervalo?.meses ? ' o ' : ''}{c.intervalo?.meses ? `${c.intervalo.meses} meses` : ''}
                          {c.kmDesdeUltimo != null ? ` · ${c.kmDesdeUltimo.toLocaleString('es-AR')} km desde última` : ''}
                          {c.serviciosEnRango > 0 ? ` · ${c.serviciosEnRango} previsto(s)` : ''}
                        </p>
                      </div>
                    )}

                    {c.tipoMetrica === 'VIDA_SERVICIO_REF' && (
                      <div>
                        {c.instancia?.kmComponente != null ? (
                          <>
                            <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                              <span>Recorrido del componente</span>
                              <span>{fmtKm(c.instancia.kmComponente)} → {fmtKm(c.instancia.kmComponenteProyectado)}</span>
                            </div>
                            {c.referenciaVida && (
                              <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden relative">
                                <div className="h-full bg-violet-400" style={{ width: `${Math.min(100, (c.instancia.kmComponenteProyectado / (c.referenciaVida.rangoMaxKm || 1)) * 100)}%` }} />
                              </div>
                            )}
                            {c.referenciaVida && <p className="text-[10px] text-neutral-400 mt-0.5">ref. {fmtKm(c.referenciaVida.rangoMinKm)}–{fmtKm(c.referenciaVida.rangoMaxKm)}</p>}
                            <p className="text-[10px] text-neutral-400">{c.instancia.origenLabel}{c.instancia.installedKm != null ? ` · instalado a ${fmtKm(c.instancia.installedKm)}` : ''}</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-neutral-400">Sin ciclo de instalación registrado — no se calcula recorrido sin inventar el punto de partida.</p>
                        )}
                      </div>
                    )}

                    {c.tipoMetrica === 'CONDICION_MEDIDA' && (
                      <div>
                        {c.neumaticosResumen ? (
                          <div>
                            <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                              <span>Peor banda ({c.neumaticosResumen.peorCodigo || '—'})</span>
                              <span className={c.neumaticosResumen.peorBandaProyectada != null && c.neumaticosResumen.peorBandaProyectada <= 2 ? 'text-red-600 font-semibold' : ''}>
                                {c.neumaticosResumen.peorBanda ?? '—'} → {c.neumaticosResumen.peorBandaProyectada ?? '—'} mm
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                              <div className={`h-full rounded-full ${(c.neumaticosResumen.peorBandaProyectada ?? 99) <= 2 ? 'bg-red-500' : (c.neumaticosResumen.peorBandaProyectada ?? 99) <= 4 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.max(0, (((c.neumaticosResumen.peorBandaProyectada ?? c.neumaticosResumen.peorBanda ?? 0) - 2) / 14) * 100))}%` }} />
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {c.neumaticosResumen.montadas} montadas · {c.neumaticosResumen.conBanda} medidas
                              {c.neumaticosResumen.reemplazosEnRango > 0 ? ` · ${c.neumaticosResumen.reemplazosEnRango} reemplazo(s) previsto(s)` : ' · sin reemplazo en el rango'}
                            </p>
                          </div>
                        ) : c.ultimaMedicion ? (
                          <p className="text-[10px] text-neutral-600">
                            Medido: <b>{c.ultimaMedicion.valor ?? c.ultimaMedicion.valorTexto ?? '—'} {c.ultimaMedicion.unidad || ''}</b> ({fmtFecha(c.ultimaMedicion.fecha)})
                            {c.proyeccionMedicion && <span className="text-neutral-400"> → ~{c.proyeccionMedicion.valorProyectado} {c.ultimaMedicion.unidad || ''} proyectado</span>}
                          </p>
                        ) : (
                          <p className="text-[10px] text-neutral-400">Sin mediciones de condición registradas.</p>
                        )}
                      </div>
                    )}

                    {/* Referencia + evidencia */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${EVIDENCIA[c.evidencia]?.cls || 'bg-neutral-100 text-neutral-500'}`}>{EVIDENCIA[c.evidencia]?.label || c.evidencia}</span>
                      <span className="text-[9px] text-neutral-400">{METRICA_LABEL[c.tipoMetrica]}</span>
                    </div>

                    {/* Por qué esta proyección */}
                    {c.porQue?.length > 0 && (
                      <div>
                        <button onClick={() => setPorQueAbierto(p => ({ ...p, [c.key]: !p[c.key] }))} className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800">
                          {porQueAbierto[c.key] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Por qué esta proyección
                        </button>
                        {porQueAbierto[c.key] && (
                          <ul className="mt-1 space-y-0.5 pl-3 border-l-2 border-violet-100">
                            {c.porQue.map((q: string, i: number) => <li key={i} className="text-[10px] text-neutral-500">{q}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Neumáticos */}
          {proy.neumaticos.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Disc className="h-3 w-3" /> Neumáticos — condición medida</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {proy.neumaticos.map((x: any) => (
                  <div key={x.codigo + x.posicion} className={`rounded-md border px-2.5 py-1.5 text-xs ${x.reemplazoEnRango ? 'border-red-200 bg-red-50' : 'border-neutral-100 bg-neutral-50'}`}>
                    <div className="flex justify-between">
                      <span className="font-medium text-neutral-800">{x.codigo}</span>
                      <span className={x.reemplazoEnRango ? 'text-red-600 font-semibold' : 'text-neutral-500'}>{x.bandaActual} → {x.bandaProyectada ?? '—'} mm</span>
                    </div>
                    <p className="text-[10px] text-neutral-400">{x.posicion} · {x.kmDesdeMontaje?.toLocaleString('es-AR')} km desde montaje{x.recaps > 0 ? ` · ${x.recaps} recap.` : ''}{x.kmRestantes != null ? ` · ${x.kmRestantes.toLocaleString('es-AR')} km rest.` : ''}{x.reemplazoEnRango ? ' · REEMPLAZO PREVISTO' : ''}</p>
                    <p className="text-[9px] text-neutral-400">{x.modeloTasa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {proy.timeline.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Timeline de eventos previstos</p>
              <ul className="space-y-1">
                {proy.timeline.map((t: any, i: number) => (
                  <li key={i} className="flex items-center gap-3 text-xs rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
                    <span className="font-mono font-medium text-neutral-700 w-20 shrink-0">{t.km.toLocaleString('es-AR')} km</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.estado === 'VENCIDO' ? 'bg-red-100 text-red-700' : t.tipo === 'NEUMATICO' ? 'bg-amber-100 text-amber-700' : t.tipo === 'EVALUACION' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.estado === 'VENCIDO' ? 'Vencido' : t.tipo === 'NEUMATICO' ? 'Neumático' : t.tipo === 'EVALUACION' ? 'Evaluación' : 'Servicio'}
                    </span>
                    <span className="flex-1 text-neutral-700">{t.detalle}</span>
                    {t.dias != null && <span className="text-neutral-400 shrink-0">~{t.dias}d</span>}
                    {t.costo != null && t.costo > 0 && <span className="text-neutral-500 shrink-0">$ {t.costo.toLocaleString('es-AR')}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documentación */}
          {proy.docsEnRango.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-1.5">
              <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {proy.docsEnRango.length} documento(s) vencen dentro del horizonte: {proy.docsEnRango.map((d: any) => d.tipo).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
