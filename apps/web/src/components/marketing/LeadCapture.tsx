'use client';

import { useState } from 'react';
import { Download, Loader2, Mail, CheckCircle2 } from 'lucide-react';

interface LeadCaptureProps {
  source: string;
  titulo: string;
  descripcion?: string;
  buttonLabel?: string;
  /** Datos extra que se guardan en meta (ej: score del checklist) */
  meta?: Record<string, unknown>;
  /** URL directa de descarga que se muestra tras el éxito (además llega por email) */
  downloadUrl?: string;
  downloadLabel?: string;
}

export function LeadCapture({
  source,
  titulo,
  descripcion,
  buttonLabel = 'Enviarme el recurso gratis',
  meta,
  downloadUrl,
  downloadLabel,
}: LeadCaptureProps) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [finalDownloadUrl, setFinalDownloadUrl] = useState<string | undefined>(downloadUrl);

  const utm = () => {
    if (typeof window === 'undefined') return {};
    const p = new URLSearchParams(window.location.search);
    return {
      utmSource: p.get('utm_source') || undefined,
      utmMedium: p.get('utm_medium') || undefined,
      utmCampaign: p.get('utm_campaign') || undefined,
    };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          nombre: nombre.trim() || undefined,
          empresa: empresa.trim() || undefined,
          source,
          meta,
          website,
          ...utm(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.downloadUrl) setFinalDownloadUrl(data.downloadUrl);
        setStatus('ok');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'ok') {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50/60 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <p className="mt-3 font-bold text-slate-900">Listo — revisá tu correo</p>
        <p className="mt-1 text-sm text-slate-600">
          Te enviamos <strong>{titulo}</strong> a <strong>{email}</strong>. Si no llega en unos minutos, revisá spam.
        </p>
        {finalDownloadUrl && (
          <a
            href={finalDownloadUrl}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-lg"
          >
            <Download className="h-4 w-4" />
            {downloadLabel || 'Descargar ahora'}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-green-700">
        <Mail className="h-5 w-5" />
        <p className="font-bold">{titulo}</p>
      </div>
      {descripcion && <p className="mt-1.5 text-sm text-slate-500">{descripcion}</p>}

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email de trabajo *"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100"
        />
        <input
          type="text"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          placeholder="Empresa (opcional)"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-green-400 focus:ring-2 focus:ring-green-100"
        />
        {/* Honeypot — invisible para humanos */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
          placeholder="Website"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3.5 font-bold text-white transition-all hover:shadow-lg disabled:opacity-60"
      >
        {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {status === 'loading' ? 'Enviando…' : buttonLabel}
      </button>

      {status === 'error' && (
        <p className="mt-3 text-center text-sm text-red-600">
          Hubo un error — intentá de nuevo o escribinos por WhatsApp.
        </p>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">
        Solo te enviamos el recurso y tips de gestión. Sin spam — podés darte de baja cuando quieras.
      </p>
    </form>
  );
}
