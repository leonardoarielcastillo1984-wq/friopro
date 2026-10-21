'use client';

// ============================================================
// Copiloto SGI360 — panel flotante transversal.
// Chat con contexto real del negocio, acciones propuestas por la
// IA que el usuario confirma con un botón (OTs, planes), e
// ingesta documental (imagen → extracción → confirmación).
// Patrón: la IA propone, el humano dispone.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Sparkles, X, Send, Paperclip, Loader2, CheckCircle2, Ban, FileText } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }
interface ProposedAction {
  type: 'CREATE_OT' | 'CREATE_ACTION_PLAN';
  title?: string;
  payload: Record<string, any>;
  status?: 'pending' | 'done' | 'failed' | 'cancelled';
  result?: string;
}
interface IngestaPreview {
  extracted: Record<string, any> | null;
  fileUrl: string; fileName: string; mimeType: string; note?: string;
}

export default function CopilotPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [ingesta, setIngesta] = useState<IngestaPreview | null>(null);
  const [ingestaBusy, setIngestaBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actions, ingesta, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setErr(null);
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const r = await apiFetch<any>('/copilot/chat', {
        method: 'POST',
        json: { messages: next.slice(-14) },
      });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply || 'Sin respuesta.' }]);
      if (r.actions?.length) {
        setActions((a) => [...a, ...r.actions.map((x: any) => ({ ...x, status: 'pending' as const }))]);
      }
    } catch (e: any) {
      setErr(e?.status === 503 ? 'El copiloto no está configurado en este entorno.' : 'Error al consultar el copiloto.');
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async (idx: number, accept: boolean) => {
    const a = actions[idx];
    if (!a || a.status !== 'pending') return;
    if (!accept) {
      setActions((prev) => prev.map((x, i) => (i === idx ? { ...x, status: 'cancelled', result: 'Cancelada por el usuario' } : x)));
      return;
    }
    try {
      const r = await apiFetch<any>('/copilot/confirm', { method: 'POST', json: { action: a } });
      setActions((prev) => prev.map((x, i) => (i === idx ? { ...x, status: 'done', result: r.message } : x)));
    } catch (e: any) {
      setActions((prev) => prev.map((x, i) => (i === idx ? { ...x, status: 'failed', result: e?.error || 'Error al ejecutar' } : x)));
    }
  };

  const onFile = async (f: File) => {
    setIngestaBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await apiFetch<any>('/copilot/ingesta', { method: 'POST', body: fd } as any);
      setIngesta(r);
    } catch {
      setErr('No se pudo procesar el archivo.');
    } finally {
      setIngestaBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmIngesta = async () => {
    if (!ingesta?.extracted || ingestaBusy) return;
    setIngestaBusy(true);
    try {
      const r = await apiFetch<any>('/copilot/ingesta/confirm', {
        method: 'POST',
        json: { ...ingesta.extracted, fileUrl: ingesta.fileUrl, fileName: ingesta.fileName, mimeType: ingesta.mimeType },
      });
      setMessages((m) => [...m, { role: 'assistant', content: `✔ ${r.message}` }]);
      setIngesta(null);
    } catch (e: any) {
      setErr(e?.error || 'No se pudo registrar el comprobante.');
    } finally {
      setIngestaBusy(false);
    }
  };

  return (
    <>
      {/* botón flotante — desplazado sobre los otros FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Copiloto IA"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-900/30 transition-transform hover:scale-105"
      >
        <Sparkles size={20} />
      </button>

      {open && (
        <div className="fixed bottom-[8.75rem] right-4 z-40 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {/* header */}
          <div className="flex items-center gap-2 border-b bg-gradient-to-r from-sky-600 to-blue-700 px-3.5 py-2.5 text-white">
            <Sparkles size={15} />
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-tight">Copiloto SGI360</p>
              <p className="text-[10px] text-sky-100/90 leading-tight">Datos reales del negocio · la IA propone, vos confirmás</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto rounded p-1 hover:bg-white/15" aria-label="Cerrar">
              <X size={15} />
            </button>
          </div>

          {/* mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
            {messages.length === 0 && (
              <div className="rounded-lg bg-sky-50 p-3 text-[12px] text-slate-600">
                <p className="font-semibold text-slate-800">¿En qué te ayudo?</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>¿Qué unidad me cuesta más este mes?</li>
                  <li>¿Cómo viene la caja próxima?</li>
                  <li>¿Hay gastos anómalos?</li>
                  <li>Creá una OT preventiva para el JKW074</li>
                  <li>📎 Adjuntá una factura/foto para cargarla</li>
                </ul>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                  m.role === 'user' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}>{m.content}</div>
              </div>
            ))}

            {/* acciones propuestas */}
            {actions.map((a, i) => (
              <div key={`a-${i}`} className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-[12px]">
                <p className="font-semibold text-slate-800">
                  {a.type === 'CREATE_OT' ? '🔧 Crear orden de trabajo' : '📋 Crear plan de acción'}
                </p>
                <p className="mt-0.5 text-slate-600">{a.payload?.title || a.payload?.findingDescription || a.title}</p>
                {a.status === 'pending' ? (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => confirmAction(i, true)} className="flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 font-semibold text-white hover:bg-sky-700">
                      <CheckCircle2 size={13} /> Confirmar
                    </button>
                    <button onClick={() => confirmAction(i, false)} className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-white">
                      <Ban size={13} /> Cancelar
                    </button>
                  </div>
                ) : (
                  <p className={`mt-1.5 flex items-center gap-1 ${a.status === 'done' ? 'text-emerald-600' : 'text-slate-500'}`}>
                    <CheckCircle2 size={12} /> {a.result}
                  </p>
                )}
              </div>
            ))}

            {/* preview de ingesta */}
            {ingesta && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12px]">
                <p className="flex items-center gap-1.5 font-semibold text-slate-800"><FileText size={13} /> Comprobante detectado</p>
                {ingesta.extracted ? (
                  <div className="mt-1.5 space-y-0.5 text-slate-700">
                    <p>{ingesta.extracted.tipoComprobante} {ingesta.extracted.numero ? `N° ${ingesta.extracted.numero}` : ''}</p>
                    {ingesta.extracted.proveedor && <p>Proveedor: {ingesta.extracted.proveedor}</p>}
                    <p className="font-semibold">Total: ${Number(ingesta.extracted.total || 0).toLocaleString('es-AR')}</p>
                    {ingesta.extracted.categoria && <p>Categoría: {ingesta.extracted.categoria}</p>}
                    {ingesta.extracted.vehiculoDominio && <p>Unidad: {ingesta.extracted.vehiculoDominio}</p>}
                    {ingesta.extracted.concepto && <p className="text-slate-500">{ingesta.extracted.concepto}</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">{ingesta.note || 'Sin extracción automática.'}</p>
                )}
                <div className="mt-2 flex gap-2">
                  {ingesta.extracted && (
                    <button onClick={confirmIngesta} disabled={ingestaBusy} className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                      {ingestaBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Registrar gasto
                    </button>
                  )}
                  <button onClick={() => setIngesta(null)} className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-white">Descartar</button>
                </div>
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <Loader2 size={13} className="animate-spin" /> Analizando datos del negocio…
              </div>
            )}
            {err && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-600">{err}</p>}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="flex items-center gap-1.5 border-t bg-slate-50 px-2.5 py-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={ingestaBusy}
              aria-label="Adjuntar comprobante"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
            >
              {ingestaBusy ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Preguntá sobre el negocio…"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-sky-400"
            />
            <button onClick={send} disabled={busy || !input.trim()} aria-label="Enviar"
              className="rounded-lg bg-sky-600 p-2 text-white hover:bg-sky-700 disabled:opacity-40">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
