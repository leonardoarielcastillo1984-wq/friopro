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

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, X, Sparkles, MousePointerClick, SendHorizonal, History } from 'lucide-react';

export type ExplicaState = { titulo: string; texto: string; via: string; loading: boolean } | null;

type HistItem = { at: number; titulo: string; pregunta?: string; texto: string; via: string };
const HIST_PREFIX = 'sgi-asist-hist:';
const HIST_MAX = 20;

export function useAsistente(opts: { anio?: number; mes?: number; moneda?: string | null; centroCostoId?: string | null; datosDe?: (metrica: string, datosEl?: any, mesRef?: number) => any }) {
  const { anio, mes, moneda, centroCostoId, datosDe } = opts;
  const [asistente, setAsistente] = useState(false);
  const [explica, setExplica] = useState<ExplicaState>(null);
  const [pregunta, setPregunta] = useState('');
  const [historial, setHistorial] = useState<HistItem[]>([]);
  const [showHist, setShowHist] = useState(false);

  const hoy = new Date();
  const anioEf = anio || hoy.getFullYear();
  const mesEf = mes || hoy.getMonth() + 1;
  const histKey = `${HIST_PREFIX}${anioEf}-${mesEf}:${moneda || ''}:${centroCostoId || ''}`;

  // Historial por contexto (período + moneda + centro). Local, sin backend.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(histKey);
      setHistorial(raw ? JSON.parse(raw) : []);
    } catch { setHistorial([]); }
    setShowHist(false);
  }, [histKey]);

  const pushHist = (item: HistItem) => {
    setHistorial(prev => {
      const next = [item, ...prev].slice(0, HIST_MAX);
      try { localStorage.setItem(histKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const pedirExplicacion = async (metrica: string, titulo: string, texto?: string, datosEl?: any, mesRef?: number, preguntaLibre?: string) => {
    setExplica({ titulo, texto: '', via: '', loading: true });
    try {
      const r = await apiFetch<{ explicacion: string; via: string; periodo: string }>('/finanzas/explicar', {
        method: 'POST',
        json: {
          metrica, titulo,
          anio: anioEf,
          mes: mesRef || mesEf,
          moneda: moneda || null,
          centroCostoId: centroCostoId || null,
          datos: datosEl !== undefined ? datosEl : (datosDe ? datosDe(metrica, undefined, mesRef) : undefined),
          texto: texto?.slice(0, 600) || null,
          pregunta: preguntaLibre || null,
        },
      });
      const tituloFull = `${r.periodo} — ${titulo}`;
      setExplica({ titulo: tituloFull, texto: r.explicacion, via: r.via, loading: false });
      pushHist({ at: Date.now(), titulo: tituloFull, pregunta: preguntaLibre, texto: r.explicacion, via: r.via });
    } catch (e: any) {
      setExplica({ titulo, texto: e?.message || 'No se pudo generar la explicación.', via: 'error', loading: false });
    }
  };

  // Pregunta libre: manda la pregunta al backend con el contexto del período.
  const preguntar = (texto: string) => {
    const t = texto.trim();
    if (!t || explica?.loading) return;
    setPregunta('');
    pedirExplicacion('pregunta', `"${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`, undefined, undefined, undefined, t);
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
    <button type="button" onClick={() => { setAsistente(a => !a); }}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${asistente ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-neutral-200 bg-white text-neutral-500 hover:border-purple-200 hover:text-purple-600'}`}>
      <MousePointerClick size={12} />
      {asistente ? 'Asistente activo — hacé click sobre cualquier número' : 'Asistente ¿qué es esto?'}
    </button>
  );

  // Barra de pregunta libre — siempre disponible, no requiere el modo click.
  const PreguntaBar = () => (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <Sparkles size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400" />
        <input
          value={pregunta}
          onChange={e => setPregunta(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); preguntar(pregunta); } }}
          placeholder="Preguntale al asistente…"
          maxLength={400}
          disabled={!!explica?.loading}
          className="w-56 rounded-lg border border-neutral-200 bg-white py-1.5 pl-7 pr-2 text-xs focus:border-purple-300 focus:outline-none disabled:opacity-50 md:w-64"
        />
      </div>
      <button type="button" onClick={() => preguntar(pregunta)} disabled={!pregunta.trim() || !!explica?.loading}
        className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40">
        {explica?.loading ? <Loader2 size={12} className="animate-spin" /> : <SendHorizonal size={12} />}
        Preguntar
      </button>
    </div>
  );

  const Panel = explica ? (
    <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-800"><Sparkles size={12} />{explica.titulo}</span>
        <div className="flex items-center gap-1">
          {historial.length > 0 && (
            <button onClick={() => setShowHist(s => !s)} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${showHist ? 'bg-purple-200 text-purple-800' : 'text-purple-400 hover:text-purple-700'}`} title="Historial de consultas del período">
              <History size={11} />{historial.length}
            </button>
          )}
          <button onClick={() => setExplica(null)} className="text-purple-400 hover:text-purple-700"><X size={14} /></button>
        </div>
      </div>
      {explica.loading
        ? <p className="flex items-center gap-1.5 text-xs text-purple-600"><Loader2 size={12} className="animate-spin" />Analizando los datos del período…</p>
        : <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">{explica.texto}</p>}
      {!explica.loading && explica.via === 'estatico' && <p className="mt-2 text-[10px] text-purple-400">Explicación de referencia (IA no configurada — GROQ_API_KEY)</p>}
      {showHist && historial.length > 0 && (
        <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto border-t border-purple-200 pt-2">
          {historial.map((h, i) => (
            <button key={i} onClick={() => setExplica({ titulo: h.titulo, texto: h.texto, via: h.via, loading: false })}
              className="block w-full rounded-lg bg-white/70 px-2.5 py-1.5 text-left text-[11px] text-neutral-600 hover:bg-white">
              <span className="font-medium text-purple-700">{h.pregunta ? `“${h.pregunta.slice(0, 70)}”` : h.titulo}</span>
              <span className="ml-1.5 text-neutral-400">{new Date(h.at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return { asistente, setAsistente, explica, setExplica, pedirExplicacion, preguntar, onAsistenteClick, wrap, Estilos, Boton, PreguntaBar, Panel };
}
