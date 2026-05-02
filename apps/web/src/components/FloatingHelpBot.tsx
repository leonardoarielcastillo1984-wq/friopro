'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  MessageCircle, X, Send, Loader2, Sparkles,
  HelpCircle, Zap, AlertCircle, Lightbulb, ChevronRight,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  structured?: boolean;
}

const QUICK_BUTTONS = [
  { label: 'Cómo usar este módulo', icon: HelpCircle },
  { label: 'Qué hace este botón', icon: Zap },
  { label: 'Buenas prácticas', icon: Lightbulb },
  { label: 'Errores comunes', icon: AlertCircle },
];

export default function FloatingHelpBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [currentModule, setCurrentModule] = useState<string>('');
  const [bubbleOffset, setBubbleOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const startDrag = (clientY: number) => {
    setDragging(true);
    dragStartY.current = clientY;
    dragStartOffset.current = bubbleOffset;
  };

  const onDrag = (clientY: number) => {
    if (!dragging) return;
    const delta = clientY - dragStartY.current;
    setBubbleOffset(dragStartOffset.current + delta);
  };

  const endDrag = () => setDragging(false);

  useEffect(() => {
    const move = (e: MouseEvent) => onDrag(e.clientY);
    const up = () => endDrag();
    if (dragging) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  useEffect(() => {
    const move = (e: TouchEvent) => onDrag(e.touches[0].clientY);
    const up = () => endDrag();
    if (dragging) {
      window.addEventListener('touchmove', move);
      window.addEventListener('touchend', up);
    }
    return () => {
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  // Resetear conversación al cambiar de módulo
  useEffect(() => {
    const ctx = detectModule();
    if (currentModule && currentModule !== ctx.module) {
      // Cambió de módulo - resetear conversación
      setMessages([]);
      setInput('');
    }
    setCurrentModule(ctx.module);
  }, [pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const detectModule = useCallback(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (!parts.length) return { module: 'inicio', screen: 'dashboard' };
    const map: Record<string, string> = {
      dashboard: 'inicio',
      project360: 'project360',
      'contexto-sgi': 'contexto',
      objetivos: 'objetivos',
      rrhh: 'rrhh',
      capacitaciones: 'capacitaciones',
      clientes: 'clientes',
      proveedores: 'proveedores',
      cumplimiento: 'cumplimiento',
      documents: 'documentos',
      seguridad: 'seguridad',
      indicadores: 'indicadores',
      calidad: 'calidad',
      auditoria: 'auditorias',
      auditorias: 'auditorias',
      'revision-direccion': 'revision-direccion',
      infraestructura: 'infraestructura',
      reportes: 'reportes',
      configuracion: 'configuracion',
      integraciones: 'integraciones',
      notificaciones: 'notificaciones',
      acciones: 'acciones',
      activos: 'activos',
      ambientales: 'ambientales',
      calibraciones: 'calibraciones',
      'gestion-cambios': 'gestion-cambios',
      incidentes: 'incidentes',
      iperc: 'iperc',
      legales: 'legales',
      licencia: 'licencia',
      licencias: 'licencias',
      mantenimiento: 'mantenimiento',
      normativos: 'normativos',
      'no-conformidades': 'no-conformidades',
      planes: 'planes',
      proyectos: 'proyectos',
      riesgos: 'riesgos',
      simulacros: 'simulacros',
      stakeholders: 'stakeholders',
      contexto: 'contexto',
      admin: 'admin',
      'modo-de-uso': 'ayuda',
    };
    const moduleId = map[parts[0]] || parts[0];
    return { module: moduleId, screen: parts[1] || moduleId };
  }, [pathname]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const ctx = detectModule();
      const res = await apiFetch<{ response: string }>('/help/ask', {
        method: 'POST',
        json: {
          message: text,
          context: { module: ctx.module, screen: ctx.screen, pathname },
          history: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        },
      });
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res?.response || 'No se pudo obtener respuesta. Intentá de nuevo.',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message?.includes('IA no configurada')
            ? 'El asistente de IA no está disponible. Contactá al administrador para configurar OpenAI u Ollama.'
            : 'Error al contactar al asistente. Verificá tu conexión e intentá de nuevo.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, pathname, detectModule]);

  const handleQuick = (label: string) => {
    const ctx = detectModule();
    const prompts: Record<string, string> = {
      'Cómo usar este módulo': `Dame una guía paso a paso de cómo usar el módulo ${ctx.module}`,
      'Qué hace este botón': `Explicame los botones principales y acciones disponibles en la pantalla ${ctx.screen} del módulo ${ctx.module}`,
      'Buenas prácticas': `Cuáles son las buenas prácticas recomendadas para usar el módulo ${ctx.module}`,
      'Errores comunes': `Cuáles son los errores comunes que debo evitar en el módulo ${ctx.module} y cómo solucionarlos`,
    };
    send(prompts[label] || label);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          onMouseDown={(e) => startDrag(e.clientY)}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          style={{ transform: `translateY(${-bubbleOffset}px)` }}
          className="fixed bottom-5 right-5 z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-grab active:cursor-grabbing"
          aria-label="Abrir asistente de ayuda"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat window */}
      {open && !minimized && (
        <div className="fixed bottom-5 right-5 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm leading-tight">Asistente SGI 360</h3>
                <p className="text-[10px] text-blue-100 opacity-90">IA contextual</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(true)}
                className="p-1.5 rounded hover:bg-blue-500 transition-colors"
                aria-label="Minimizar"
              >
                <span className="block w-3 h-0.5 bg-white rounded" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-blue-500 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-900">
                  <p className="font-medium mb-1">Hola, soy tu asistente de ayuda</p>
                  <p className="text-blue-800/80">Preguntame cómo usar el sistema, qué hace un campo o cuáles son las buenas prácticas.</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_BUTTONS.map((btn) => {
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.label}
                        onClick={() => handleQuick(btn.label)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      >
                        <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-gray-800">{btn.label}</span>
                        <ChevronRight className="w-3 h-3 text-gray-400 ml-auto shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] text-sm px-3 py-2.5 rounded-xl whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-xs text-gray-500">Pensando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2.5">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí tu pregunta..."
                className="flex-1 text-sm px-3 py-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Minimized bar */}
      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          onMouseDown={(e) => startDrag(e.clientY)}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          style={{ transform: `translateY(${-bubbleOffset}px)` }}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all cursor-grab active:cursor-grabbing"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Asistente SGI 360</span>
        </button>
      )}
    </>
  );
}
