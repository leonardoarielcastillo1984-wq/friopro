'use client';

// Asistente "¿Qué es esto?" — compartido por todas las pestañas de Resultados.
// Uso:
//   const A = useAsistente({ anio, mes, moneda, centroCostoId });
//   return <div {...A.wrap}>…<A.Boton />…</div>;
// Cualquier elemento con data-explica="metrica" (más data-explica-titulo,
// data-explica-texto, data-explica-mes y data-explica-datos={JSON}) se vuelve
// explicable con click mientras el modo está activo.
// En gráficos de recharts, el click sobre una barra NO se intercepta: el
// propio Bar onClick decide (ver A.explicarMes para gráficos por mes).

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, X, Sparkles, MousePointerClick } from 'lucide-react';

export type ExplicaState = { titulo: string; texto: string; via: string; loading: boolean } | null;

export function useAsistente(opts: { anio?: number; mes?: number; moneda?: string | null; centroCostoId?: string | null; datosDe?: (metrica: string, datosEl?: any, mesRef?: number) => any }) {
  const { anio, mes, moneda, centroCostoId, datosDe } = opts;
  const [asistente, setAsistente] = useState(false);
  const [explica, setExplica] = useState<ExplicaState>(null);

  const hoy = new Date();

  const pedirExplicacion = async (metrica: string, titulo: string, texto?: string, datosEl?: any, mesRef?: number) => {
    setExplica({ titulo, texto: '', via: '', loading: true });
    try {
      const r = await apiFetch<{ explicacion: string; via: string; periodo: string }>('/finanzas/explicar', {
        method: 'POST',
        json: {
          metrica, titulo,
          anio: anio || hoy.getFullYear(),
          mes: mesRef || mes || hoy.getMonth() + 1,
          moneda: moneda || null,
          centroCostoId: centroCostoId || null,
          datos: datosEl !== undefined ? datosEl : (datosDe ? datosDe(metrica, undefined, mesRef) : undefined),
          texto: texto?.slice(0, 600) || null,
        },
      });
      setExplica({ titulo: `${r.periodo} — ${titulo}`, texto: r.explicacion, via: r.via, loading: false });
    } catch (e: any) {
      setExplica({ titulo, texto: e?.message || 'No se pudo generar la explicación.', via: 'error', loading: false });
    }
  };

  // Click-capture en el contenedor: si el modo está activo y el click cae
  // sobre un [data-explica], pide la explicación y corta la acción original.
  // Excepción: barras/puntos de recharts — su propio onClick resuelve
  // (permite explicar el mes/barra exacta clickeada).
  const onAsistenteClick = (e: React.MouseEvent) => {
    if (!asistente) return;
    const t = e.target as HTMLElement;
    if (t.closest?.('.recharts-bar-rectangle, .recharts-dot, .recharts-sector, .recharts-line-dot')) return;
    const el = t.closest('[data-explica]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const mesRef = el.dataset.explicaMes ? Number(el.dataset.explicaMes) : undefined;
    let datosEl: any;
    if (el.dataset.explicaDatos) { try { datosEl = JSON.parse(el.dataset.explicaDatos); } catch { /* ignore */ } }
    if (datosEl === undefined && datosDe) datosEl = datosDe(el.dataset.explica!, undefined, mesRef);
    pedirExplicacion(
      el.dataset.explica!,
      el.dataset.explicaTitulo || el.textContent?.slice(0, 80) || 'Indicador',
      el.dataset.explicaTexto || el.textContent || undefined,
      datosEl,
      mesRef,
    );
  };

  // Props para el contenedor raíz de cada pestaña.
  const wrap = {
    className: asistente ? 'asist-on' : '',
    onClickCapture: onAsistenteClick,
  };

  const Estilos = asistente ? (
    <style>{`.asist-on, .asist-on * { cursor: help !important; } .asist-on [data-explica] { outline: 1.5px dashed transparent; border-radius: 6px; transition: outline-color .15s; } .asist-on [data-explica]:hover { outline-color: #7c3aed; background: rgba(124,58,237,.05); }`}</style>
  ) : null;

  const Boton = () => (
    <button type="button" onClick={() => { setAsistente(a => !a); setExplica(null); }}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${asistente ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-neutral-200 bg-white text-neutral-500 hover:border-purple-200 hover:text-purple-600'}`}>
      <MousePointerClick size={12} />
      {asistente ? 'Asistente activo — hacé click sobre cualquier número' : 'Asistente ¿qué es esto?'}
    </button>
  );

  const Panel = explica ? (
    <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-800"><Sparkles size={12} />{explica.titulo}</span>
        <button onClick={() => setExplica(null)} className="text-purple-400 hover:text-purple-700"><X size={14} /></button>
      </div>
      {explica.loading
        ? <p className="flex items-center gap-1.5 text-xs text-purple-600"><Loader2 size={12} className="animate-spin" />Analizando los datos del período…</p>
        : <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">{explica.texto}</p>}
      {!explica.loading && explica.via === 'estatico' && <p className="mt-2 text-[10px] text-purple-400">Explicación de referencia (IA no configurada — GROQ_API_KEY)</p>}
    </div>
  ) : null;

  return { asistente, setAsistente, explica, setExplica, pedirExplicacion, onAsistenteClick, wrap, Estilos, Boton, Panel };
}
