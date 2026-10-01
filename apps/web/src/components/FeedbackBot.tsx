'use client';

import { useState } from 'react';
import { Lightbulb, X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useDraggableFab } from '@/hooks/useDraggableFab';

const TIPOS = [
  { value: 'SUGERENCIA', label: 'Sugerencia', desc: 'Idea para mejorar el sistema' },
  { value: 'ERROR',      label: 'Reporte de error', desc: 'Algo no funciona como debería' },
  { value: 'PREGUNTA',   label: 'Pregunta',   desc: 'Consulta sobre una funcionalidad' },
];

export default function FeedbackBot() {
  const fab = useDraggableFab('feedback');
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('SUGERENCIA');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => { setOpen(false); setDone(false); setMensaje(''); setTipo('SUGERENCIA'); setErr(''); };

  const enviar = async () => {
    if (mensaje.trim().length < 3) return;
    setSending(true); setErr('');
    try {
      await apiFetch('/feedback', {
        method: 'POST',
        json: { tipo, mensaje: mensaje.trim(), pagina: window.location.pathname },
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || 'No se pudo enviar. Intentá de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    // Default: esquina inferior izquierda (los FAB de la derecha ya están ocupados).
    // Arrastrable: la posición elegida se guarda en localStorage.
    <div
      ref={fab.ref}
      className={`fixed z-50 flex flex-col items-end gap-3 ${fab.style ? '' : 'bottom-6 left-6'}`}
      style={fab.style}
    >
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">{done ? '¡Enviado!' : 'Sugerencias al desarrollador'}</span>
            </div>
            <button onClick={reset} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {done ? (
            <div className="p-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-gray-900">¡Gracias por tu mensaje!</p>
              <p className="text-xs text-gray-500">Llegó al equipo de desarrollo. Si hace falta te respondemos por mail.</p>
              <button onClick={reset} className="text-sm text-amber-600 hover:text-amber-800 font-medium">Cerrar</button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex gap-1.5">
                {TIPOS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setTipo(t.value)} title={t.desc}
                    className={`flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-all ${tipo === t.value ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Contanos tu idea, problema o duda…"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none"
              />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <p className="text-[10px] text-gray-400">Se envía con tu nombre, empresa y la página donde estás. Es para sugerencias — no soporte urgente.</p>
              <button onClick={enviar} disabled={sending || mensaje.trim().length < 3}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        {...fab.dragProps}
        onClick={() => { if (fab.wasDrag()) return; open ? reset() : setOpen(true); }}
        title="Sugerencias al desarrollador (arrastrá para mover)"
        className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${open ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gradient-to-br from-amber-400 to-orange-500 hover:scale-105'}`}>
        {open ? <X className="w-5 h-5 text-white" /> : <Lightbulb className="w-5 h-5 text-white" />}
      </button>
    </div>
  );
}
