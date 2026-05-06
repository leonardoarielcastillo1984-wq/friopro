'use client';

import { useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const TIPOS = [
  { value: 'SUGERENCIA', label: '💡 Sugerencia', desc: 'Idea para mejorar algo' },
  { value: 'RECLAMO',    label: '⚠️ Reclamo',    desc: 'Algo que no está bien' },
  { value: 'INQUIETUD',  label: '🤔 Inquietud',  desc: 'Algo que me preocupa' },
  { value: 'MEJORA',     label: '🚀 Mejora',     desc: 'Propuesta de optimización' },
  { value: 'ALERTA',     label: '🔴 Alerta',     desc: 'Situación urgente' },
];

const PRIORIDADES = [
  { value: 'BAJA',   label: 'Baja' },
  { value: 'MEDIA',  label: 'Media' },
  { value: 'ALTA',   label: 'Alta' },
  { value: 'CRITICA', label: 'Crítica' },
];

type Step = 'closed' | 'type' | 'form' | 'done';

export function SugerenciaBot() {
  const [step, setStep] = useState<Step>('closed');
  const [tipo, setTipo] = useState('SUGERENCIA');
  const [form, setForm] = useState({ title: '', content: '', priority: 'MEDIA', isAnonymous: true });
  const [sending, setSending] = useState(false);

  function reset() {
    setStep('closed');
    setTipo('SUGERENCIA');
    setForm({ title: '', content: '', priority: 'MEDIA', isAnonymous: true });
    setSending(false);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true);
    try {
      await apiFetch('/clima/sugerencias', {
        method: 'POST',
        body: JSON.stringify({ ...form, type: tipo }),
      });
      setStep('done');
    } catch {
      alert('Error al enviar. Intentá de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      {step !== 'closed' && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">
                {step === 'done' ? '¡Enviado!' : 'Buzón de sugerencias'}
              </span>
            </div>
            <button onClick={reset} className="text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step: tipo */}
          {step === 'type' && (
            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">¿Qué querés comunicar?</p>
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setTipo(t.value); setStep('form'); }}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-all group"
                >
                  <span className="text-lg">{t.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{t.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: form */}
          {step === 'form' && (
            <form onSubmit={handleSend} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStep('type')} className="text-xs text-gray-400 hover:text-gray-600">← Cambiar tipo</button>
                <span className="text-xs text-gray-500">·</span>
                <span className="text-xs font-medium text-teal-700">{TIPOS.find(t => t.value === tipo)?.label}</span>
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder="Título breve *"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                />
              </div>

              <div>
                <textarea
                  required
                  placeholder="Contanos más detalles... *"
                  rows={3}
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={form.priority}
                  onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none flex-1"
                >
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isAnonymous}
                    onChange={e => setForm(p => ({ ...p, isAnonymous: e.target.checked }))}
                    className="rounded text-teal-500"
                  />
                  Anónimo
                </label>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">¡Gracias por tu mensaje!</p>
                <p className="text-xs text-gray-500 mt-1">Tu {TIPOS.find(t => t.value === tipo)?.label.split(' ').slice(1).join(' ').toLowerCase()} fue registrada correctamente.</p>
              </div>
              <button onClick={reset} className="text-sm text-teal-600 hover:text-teal-800 font-medium">
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => step === 'closed' ? setStep('type') : reset()}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${step !== 'closed' ? 'bg-gray-600 hover:bg-gray-700 rotate-0' : 'bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 hover:scale-105'}`}
        title="Buzón de sugerencias"
      >
        {step !== 'closed'
          ? <X className="w-5 h-5 text-white" />
          : <MessageSquarePlus className="w-6 h-6 text-white" />
        }
      </button>
    </div>
  );
}
