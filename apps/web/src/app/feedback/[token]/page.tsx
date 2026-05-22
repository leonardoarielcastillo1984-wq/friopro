'use client';
import { useState, useEffect } from 'react';
import { Star, CheckCircle, AlertTriangle, Truck, Calendar, ClipboardCheck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

const PROBLEMAS = [
  { value: 'GOLPE_CAJA', label: 'Golpe / daño en caja o carrocería' },
  { value: 'PRECINTO_ROTO', label: 'Precinto roto o violado' },
  { value: 'FALTANTE', label: 'Faltante de mercadería' },
  { value: 'HUMEDAD', label: 'Humedad / mojado' },
  { value: 'TEMPERATURA', label: 'Falla de temperatura / cadena de frío' },
  { value: 'OTRO', label: 'Otro problema' },
];

const ESTADO_COLOR: Record<string, string> = {
  COMPLETA: 'bg-emerald-100 text-emerald-700',
  CON_HALLAZGOS: 'bg-amber-100 text-amber-700',
  CRITICA: 'bg-red-100 text-red-700',
  INCOMPLETA: 'bg-gray-100 text-gray-500',
};

export default function FeedbackPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [inspeccion, setInspeccion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [discrepancia, setDiscrepancia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    receptorNombre: '',
    receptorEmpresa: '',
    calificacion: 0,
    comentario: '',
    problemaDetectado: '',
  });

  useEffect(() => {
    fetch(`${API_BASE}/inspecciones/feedback/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setInspeccion(d.inspeccion);
        if (d.inspeccion.feedback) setEnviado(true);
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la información'); setLoading(false); });
  }, [token]);

  const handleSubmit = async () => {
    if (form.calificacion === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/inspecciones/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receptorNombre: form.receptorNombre || undefined,
          receptorEmpresa: form.receptorEmpresa || undefined,
          calificacion: form.calificacion,
          comentario: form.comentario || undefined,
          problemaDetectado: form.problemaDetectado || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnviado(true);
        setDiscrepancia(data.discrepanciaDetectada);
      } else {
        alert(data.error || 'Error al enviar');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">{error}</p>
        <p className="text-sm text-gray-400 mt-1">El link puede estar vencido o ser inválido</p>
      </div>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-9 h-9 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Gracias por tu calificación!</h2>
        <p className="text-sm text-gray-500 mb-4">Tu feedback fue registrado correctamente.</p>
        {discrepancia && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Discrepancia detectada</p>
            <p className="text-xs text-amber-600">El problema que reportaste no fue registrado por el conductor. El supervisor fue notificado.</p>
          </div>
        )}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex justify-center gap-0.5">
            {[1,2,3,4,5].map(s => (
              <Star key={s} className={`w-6 h-6 ${s <= (inspeccion?.feedback?.calificacion || form.calificacion) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Tu calificación</p>
        </div>
      </div>
    </div>
  );

  const fecha = new Date(inspeccion.createdAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ClipboardCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Calificá tu entrega</h1>
          <p className="text-sm text-gray-500 mt-1">Tu opinión nos ayuda a mejorar el servicio</p>
        </div>

        {/* Info de la inspección */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{inspeccion.activoNombre}</p>
              {inspeccion.dominioTractor && (
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Tractor: <span className="font-semibold text-gray-700">{inspeccion.dominioTractor}</span>
                  {inspeccion.dominioSemi && <> · Semi: <span className="font-semibold text-gray-700">{inspeccion.dominioSemi}</span></>}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[inspeccion.estado] || 'bg-gray-100 text-gray-500'}`}>
                  Check: {inspeccion.estado === 'CON_HALLAZGOS' ? 'Con hallazgos' : inspeccion.estado === 'COMPLETA' ? 'Aprobado' : inspeccion.estado.charAt(0) + inspeccion.estado.slice(1).toLowerCase()}
                </span>
                {inspeccion.puntaje !== null && (
                  <span className={`text-[10px] font-semibold ${inspeccion.puntaje >= 80 ? 'text-emerald-600' : inspeccion.puntaje >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {inspeccion.puntaje}% cumplimiento
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            <span>Inspeccionado el {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} a las {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">

          {/* Estrellas */}
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700 mb-3">¿Cómo llegó tu carga?</p>
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, calificacion: s }))} className="transition-transform active:scale-90">
                  <Star className={`w-10 h-10 transition-colors ${s <= form.calificacion ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200 hover:text-amber-300 hover:fill-amber-300'}`} />
                </button>
              ))}
            </div>
            {form.calificacion > 0 && (
              <p className="text-sm font-medium mt-2 text-gray-600">
                {form.calificacion === 5 ? '🎉 ¡Excelente!' : form.calificacion === 4 ? '😊 Muy bien' : form.calificacion === 3 ? '😐 Regular' : form.calificacion === 2 ? '😟 Mal' : '😠 Muy mal'}
              </p>
            )}
          </div>

          {/* Problema (solo si calificación baja) */}
          {form.calificacion > 0 && form.calificacion <= 3 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">¿Qué problema encontraste?</p>
              <div className="grid grid-cols-1 gap-1.5">
                {PROBLEMAS.map(p => (
                  <button key={p.value}
                    onClick={() => setForm(f => ({ ...f, problemaDetectado: f.problemaDetectado === p.value ? '' : p.value }))}
                    className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${form.problemaDetectado === p.value ? 'bg-red-50 border-red-300 text-red-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comentario */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Comentario (opcional)</p>
            <textarea value={form.comentario} onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))}
              placeholder="Contanos más sobre tu experiencia..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>

          {/* Datos del receptor */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Tus datos (opcional)</p>
            <input value={form.receptorNombre} onChange={e => setForm(f => ({ ...f, receptorNombre: e.target.value }))}
              placeholder="Tu nombre"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
            <input value={form.receptorEmpresa} onChange={e => setForm(f => ({ ...f, receptorEmpresa: e.target.value }))}
              placeholder="Empresa / razón social"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <button onClick={handleSubmit} disabled={form.calificacion === 0 || submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {submitting ? 'Enviando...' : 'Enviar calificación'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">Powered by LogiSmart · Sistema de gestión logística</p>
      </div>
    </div>
  );
}
